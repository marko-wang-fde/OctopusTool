package octopusedge

import (
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/quic-go/quic-go"
)

const (
	ALPN                         = "octopus-edge/0"
	GatewayBrokerAttachTransport = "quic"
	DefaultBrokerVersion         = "go-lib-dev"
)

type Broker struct {
	Profile        Profile
	Services       []ChannelSpec
	Client         *JCodeClient
	BrokerVersion  string
	Dialer         GatewayDialer
	DialTarget     func(ctx context.Context, network, address string) (net.Conn, error)
	Sleep          func(context.Context, time.Duration) error
	Status         func(BrokerStatus)
	ProfileUpdated func(Profile)
}

type BrokerStatus struct {
	State           string
	Running         bool
	ConnectionID    string
	EndpointVersion int64
	LastError       string
	ReconnectDelay  time.Duration
	ActiveSessions  int
	UpdatedAt       time.Time
}

type GatewayDialer interface {
	DialGateway(ctx context.Context, endpoint ResolvedEndpoint) (GatewayConnection, error)
}

type GatewayConnection interface {
	OpenAttachStream(ctx context.Context) (io.ReadWriteCloser, error)
	AcceptSessionStream(ctx context.Context) (io.ReadWriteCloser, error)
	Closed() <-chan error
	CloseWithError(code uint64, reason string) error
}

type GatewayBrokerAttach struct {
	MessageType       string   `json:"type"`
	Transport         string   `json:"transport"`
	TeamID            string   `json:"teamId"`
	BrokerInstanceID  string   `json:"brokerInstanceId"`
	ConnectionID      string   `json:"connectionId"`
	RuntimeClusterKey string   `json:"runtimeClusterKey"`
	RunningInstanceID string   `json:"runningInstanceId"`
	EndpointVersion   int64    `json:"endpointVersion"`
	CredentialVersion int64    `json:"credentialVersion"`
	Credential        string   `json:"credential"`
	BrokerVersion     string   `json:"brokerVersion"`
	Capabilities      []string `json:"capabilities"`
}

type GatewaySessionOpen struct {
	MessageType                     string `json:"type"`
	StreamID                        string `json:"streamId"`
	SessionID                       string `json:"sessionId"`
	TeamID                          string `json:"teamId"`
	EdgeServiceID                   string `json:"edgeServiceId"`
	TeamBandwidthLimitBitsPerSecond uint64 `json:"teamBandwidthLimitBitsPerSecond"`
}

type brokerTarget struct {
	name string
	addr string
}

func (b *Broker) Run(ctx context.Context) error {
	profile := b.Profile
	if err := profile.ValidateForStart(); err != nil {
		b.emit(BrokerStatus{State: "unbound", Running: false, LastError: err.Error()})
		return err
	}
	if len(b.Services) == 0 {
		err := errors.New("at least one service is required")
		b.emit(BrokerStatus{State: "unbound", Running: false, LastError: err.Error()})
		return err
	}
	client := b.Client
	if client == nil {
		var err error
		client, err = NewJCodeClient(profile.Account, profile.Host)
		if err != nil {
			b.emit(BrokerStatus{State: "unbound", Running: false, LastError: err.Error()})
			return err
		}
	}
	dialer := b.Dialer
	if dialer == nil {
		dialer = QUICGatewayDialer{}
	}
	sleep := b.Sleep
	if sleep == nil {
		sleep = sleepContext
	}
	dialTarget := b.DialTarget
	if dialTarget == nil {
		var nd net.Dialer
		dialTarget = nd.DialContext
	}
	brokerVersion := strings.TrimSpace(b.BrokerVersion)
	if brokerVersion == "" {
		brokerVersion = DefaultBrokerVersion
	}
	profile, err := b.refreshProfileIfNeeded(ctx, client, profile)
	if err != nil {
		b.emit(BrokerStatus{State: "unbound", Running: false, LastError: err.Error()})
		return err
	}
	targets, err := b.syncTargets(ctx, client, profile)
	if err != nil {
		b.emit(BrokerStatus{State: "unbound", Running: false, LastError: err.Error()})
		return err
	}

	var lastEndpointVersion int64
	var attempt int
	policy := ReconnectPolicy{InitialDelayMs: 1000, MaxDelayMs: 30000}
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		b.emit(BrokerStatus{State: "resolving_endpoint", Running: false})
		endpoint, err := client.ResolveEndpoint(ctx, profile.AccessToken, ResolveEndpointInput{
			BrokerInstanceID:    profile.BrokerInstanceID,
			BindingCredential:   profile.BindingCredential,
			BrokerVersion:       brokerVersion,
			LastEndpointVersion: lastEndpointVersion,
		})
		if err != nil {
			if !isRetryableResolveError(err) {
				b.emit(BrokerStatus{State: "disconnected", Running: false, LastError: err.Error()})
				return err
			}
			delay := reconnectDelay(policy, attempt)
			b.emit(BrokerStatus{State: "disconnected", Running: false, LastError: err.Error(), ReconnectDelay: delay})
			attempt++
			if err := sleep(ctx, delay); err != nil {
				return err
			}
			continue
		}
		if err := validateEndpoint(endpoint); err != nil {
			b.emit(BrokerStatus{State: "disconnected", Running: false, LastError: err.Error()})
			return err
		}
		policy = normalizeReconnectPolicy(endpoint.ReconnectPolicy)
		lastEndpointVersion = endpoint.EndpointVersion
		err = b.connectAndServe(ctx, dialer, dialTarget, profile, brokerVersion, endpoint, targets)
		if err == nil {
			attempt = 0
			continue
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		delay := reconnectDelay(policy, attempt)
		b.emit(BrokerStatus{State: "disconnected", Running: false, LastError: err.Error(), ReconnectDelay: delay, EndpointVersion: endpoint.EndpointVersion})
		attempt++
		if err := sleep(ctx, delay); err != nil {
			return err
		}
	}
}

func (b *Broker) refreshProfileIfNeeded(ctx context.Context, client *JCodeClient, profile Profile) (Profile, error) {
	if strings.TrimSpace(profile.AccessToken) != "" && profile.AccessTokenExpiresAt.After(time.Now().Add(time.Minute)) {
		return profile, nil
	}
	credentials, err := client.RefreshCredentials(ctx, profile.RefreshToken)
	if err != nil {
		return Profile{}, fmt.Errorf("refresh credentials: %w", err)
	}
	profile.AccessToken = credentials.AccessToken
	profile.AccessTokenExpiresAt = credentials.AccessTokenExpiresAt
	profile.RefreshToken = credentials.RefreshToken
	profile.RefreshTokenExpiresAt = credentials.RefreshTokenExpiresAt
	if b.ProfileUpdated != nil {
		b.ProfileUpdated(profile)
	}
	return profile, nil
}

func (b *Broker) syncTargets(ctx context.Context, client *JCodeClient, profile Profile) (map[string]brokerTarget, error) {
	registry, err := NewChannelRegistry(b.Services)
	if err != nil {
		return nil, err
	}
	manifest, err := registry.Manifest()
	if err != nil {
		return nil, err
	}
	synced, err := client.SyncServices(ctx, profile.AccessToken, SyncServicesInput{
		BrokerInstanceID: profile.BrokerInstanceID,
		Services:         manifest,
	})
	if err != nil {
		return nil, fmt.Errorf("sync services: %w", err)
	}
	items, err := registry.ApplySync(synced)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, errors.New("no active service targets were accepted by Host")
	}
	targets := make(map[string]brokerTarget, len(items))
	for _, item := range items {
		addr := net.JoinHostPort(strings.TrimSpace(item.TargetHost), strconv.Itoa(item.TargetPort))
		targets[item.EdgeServiceID] = brokerTarget{name: item.Name, addr: addr}
	}
	return targets, nil
}

func (b *Broker) connectAndServe(ctx context.Context, dialer GatewayDialer, dialTarget func(context.Context, string, string) (net.Conn, error), profile Profile, brokerVersion string, endpoint ResolvedEndpoint, targets map[string]brokerTarget) error {
	b.emit(BrokerStatus{State: "connecting_quic", Running: false, EndpointVersion: endpoint.EndpointVersion})
	conn, err := dialer.DialGateway(ctx, endpoint)
	if err != nil {
		return fmt.Errorf("connect octopus-edge-gateway: %w", err)
	}
	defer conn.CloseWithError(0, "broker stopped")
	connectionID := nextConnectionID()
	b.emit(BrokerStatus{State: "authenticating", Running: false, ConnectionID: connectionID, EndpointVersion: endpoint.EndpointVersion})
	if err := authenticateGatewayBrokerAttach(ctx, conn, buildGatewayBrokerAttach(profile, brokerVersion, endpoint, connectionID)); err != nil {
		return err
	}
	b.emit(BrokerStatus{State: "online", Running: true, ConnectionID: connectionID, EndpointVersion: endpoint.EndpointVersion})
	var active atomic.Int32
	errc := make(chan error, 1)
	for {
		acceptc := make(chan io.ReadWriteCloser, 1)
		go func() {
			stream, err := conn.AcceptSessionStream(ctx)
			if err != nil {
				select {
				case errc <- err:
				default:
				}
				return
			}
			acceptc <- stream
		}()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-conn.Closed():
			if err == nil {
				err = errors.New("gateway QUIC connection closed")
			}
			return err
		case err := <-errc:
			return fmt.Errorf("accept gateway session stream: %w", err)
		case stream := <-acceptc:
			active.Add(1)
			b.emit(BrokerStatus{State: "online", Running: true, ConnectionID: connectionID, EndpointVersion: endpoint.EndpointVersion, ActiveSessions: int(active.Load())})
			go func() {
				defer active.Add(-1)
				defer stream.Close()
				if err := handleGatewaySession(ctx, stream, targets, dialTarget); err != nil {
					b.emit(BrokerStatus{State: "online", Running: true, ConnectionID: connectionID, EndpointVersion: endpoint.EndpointVersion, LastError: err.Error(), ActiveSessions: int(active.Load())})
				}
			}()
		}
	}
}

func authenticateGatewayBrokerAttach(ctx context.Context, conn GatewayConnection, attach GatewayBrokerAttach) error {
	stream, err := conn.OpenAttachStream(ctx)
	if err != nil {
		return fmt.Errorf("open gateway broker attach stream: %w", err)
	}
	defer stream.Close()
	line, err := json.Marshal(attach)
	if err != nil {
		return err
	}
	line = append(line, '\n')
	if _, err := stream.Write(line); err != nil {
		return fmt.Errorf("write gateway broker attach: %w", err)
	}
	reader := bufio.NewReader(stream)
	ackLine, err := reader.ReadBytes('\n')
	if err != nil {
		return fmt.Errorf("read gateway broker attach ack: %w", err)
	}
	var ack struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(ackLine, &ack); err != nil {
		return fmt.Errorf("parse gateway broker attach ack: %w", err)
	}
	if ack.Type != "gatewayBrokerAttachAccepted" {
		return fmt.Errorf("gateway broker attach rejected: %s", strings.TrimSpace(string(ackLine)))
	}
	return nil
}

func buildGatewayBrokerAttach(profile Profile, brokerVersion string, endpoint ResolvedEndpoint, connectionID string) GatewayBrokerAttach {
	return GatewayBrokerAttach{
		MessageType:       "gatewayBrokerAttach",
		Transport:         GatewayBrokerAttachTransport,
		TeamID:            profile.TeamID,
		BrokerInstanceID:  profile.BrokerInstanceID,
		ConnectionID:      connectionID,
		RuntimeClusterKey: endpoint.RuntimeClusterKey,
		RunningInstanceID: endpoint.RunningInstanceID,
		EndpointVersion:   endpoint.EndpointVersion,
		CredentialVersion: endpoint.CredentialVersion,
		Credential:        endpoint.Credential,
		BrokerVersion:     brokerVersion,
		Capabilities:      []string{"tcp-stream"},
	}
}

func handleGatewaySession(ctx context.Context, stream io.ReadWriter, targets map[string]brokerTarget, dialTarget func(context.Context, string, string) (net.Conn, error)) error {
	reader := bufio.NewReader(stream)
	line, err := reader.ReadBytes('\n')
	if err != nil {
		return fmt.Errorf("read gateway session-open: %w", err)
	}
	var open GatewaySessionOpen
	if err := json.Unmarshal(line, &open); err != nil {
		return fmt.Errorf("parse gateway session-open: %w", err)
	}
	if open.MessageType != "gatewaySessionOpen" || strings.TrimSpace(open.EdgeServiceID) == "" || strings.TrimSpace(open.TeamID) == "" || open.TeamBandwidthLimitBitsPerSecond == 0 {
		return errors.New("invalid gateway session-open route")
	}
	target, ok := targets[open.EdgeServiceID]
	if !ok {
		return fmt.Errorf("unmapped edgeServiceId %s", open.EdgeServiceID)
	}
	tcp, err := dialTarget(ctx, "tcp", target.addr)
	if err != nil {
		return fmt.Errorf("connect target TCP %s: %w", target.addr, err)
	}
	defer tcp.Close()
	return pipeSessionToTCP(reader, stream, tcp)
}

func pipeSessionToTCP(sessionRead io.Reader, sessionWrite io.Writer, tcp net.Conn) error {
	var wg sync.WaitGroup
	errc := make(chan error, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, err := io.Copy(tcp, sessionRead)
		if closeWriter, ok := tcp.(interface{ CloseWrite() error }); ok {
			_ = closeWriter.CloseWrite()
		}
		errc <- err
	}()
	go func() {
		defer wg.Done()
		_, err := io.Copy(sessionWrite, tcp)
		if closeWriter, ok := sessionWrite.(interface{ CloseWrite() error }); ok {
			_ = closeWriter.CloseWrite()
		}
		errc <- err
	}()
	wg.Wait()
	close(errc)
	for err := range errc {
		if err != nil {
			return err
		}
	}
	return nil
}

type QUICGatewayDialer struct {
	TLSConfig *tls.Config
	Config    *quic.Config
}

func (d QUICGatewayDialer) DialGateway(ctx context.Context, endpoint ResolvedEndpoint) (GatewayConnection, error) {
	tlsConfig := d.TLSConfig
	if tlsConfig == nil {
		roots, err := x509.SystemCertPool()
		if err != nil || roots == nil {
			roots = x509.NewCertPool()
		}
		tlsConfig = &tls.Config{
			NextProtos: []string{ALPN},
			ServerName: endpoint.ServerName,
			RootCAs:    roots,
			MinVersion: tls.VersionTLS12,
		}
	} else {
		tlsConfig = tlsConfig.Clone()
		if tlsConfig.ServerName == "" {
			tlsConfig.ServerName = endpoint.ServerName
		}
		if len(tlsConfig.NextProtos) == 0 {
			tlsConfig.NextProtos = []string{ALPN}
		}
	}
	config := d.Config
	if config == nil {
		config = defaultQUICConfig(endpoint)
	}
	conn, err := quic.DialAddr(ctx, endpoint.PublicQuicAddress, tlsConfig, config)
	if err != nil {
		return nil, err
	}
	return &quicGatewayConnection{conn: conn, closed: make(chan error, 1)}, nil
}

func defaultQUICConfig(endpoint ResolvedEndpoint) *quic.Config {
	heartbeat := time.Duration(endpoint.HeartbeatInterval) * time.Millisecond
	if heartbeat <= 0 {
		heartbeat = 10 * time.Second
	}
	maxIdle := heartbeat * 3
	if maxIdle < 15*time.Second {
		maxIdle = 15 * time.Second
	}
	keepAlive := heartbeat
	if keepAlive > 10*time.Second {
		keepAlive = 10 * time.Second
	}
	return &quic.Config{
		MaxIdleTimeout:  maxIdle,
		KeepAlivePeriod: keepAlive,
	}
}

type quicGatewayConnection struct {
	conn   *quic.Conn
	once   sync.Once
	closed chan error
}

func (c *quicGatewayConnection) OpenAttachStream(ctx context.Context) (io.ReadWriteCloser, error) {
	return c.conn.OpenStreamSync(ctx)
}

func (c *quicGatewayConnection) AcceptSessionStream(ctx context.Context) (io.ReadWriteCloser, error) {
	return c.conn.AcceptStream(ctx)
}

func (c *quicGatewayConnection) Closed() <-chan error {
	c.once.Do(func() {
		go func() {
			<-c.conn.Context().Done()
			c.closed <- c.conn.Context().Err()
		}()
	})
	return c.closed
}

func (c *quicGatewayConnection) CloseWithError(code uint64, reason string) error {
	c.conn.CloseWithError(quic.ApplicationErrorCode(code), reason)
	return nil
}

func validateEndpoint(endpoint ResolvedEndpoint) error {
	if strings.TrimSpace(endpoint.PublicQuicAddress) == "" ||
		strings.TrimSpace(endpoint.ServerName) == "" ||
		strings.TrimSpace(endpoint.RuntimeClusterKey) == "" ||
		strings.TrimSpace(endpoint.RunningInstanceID) == "" ||
		strings.TrimSpace(endpoint.Credential) == "" ||
		endpoint.EndpointVersion == 0 ||
		endpoint.CredentialVersion == 0 ||
		endpoint.HeartbeatInterval == 0 {
		return errors.New("octopus-edge endpoint resolve response is incomplete")
	}
	if endpoint.ReconnectPolicy.InitialDelayMs <= 0 || endpoint.ReconnectPolicy.MaxDelayMs < endpoint.ReconnectPolicy.InitialDelayMs {
		return errors.New("invalid reconnect policy")
	}
	return nil
}

func normalizeReconnectPolicy(policy ReconnectPolicy) ReconnectPolicy {
	if policy.InitialDelayMs <= 0 || policy.MaxDelayMs < policy.InitialDelayMs {
		return ReconnectPolicy{InitialDelayMs: 1000, MaxDelayMs: 30000}
	}
	return policy
}

func reconnectDelay(policy ReconnectPolicy, attempt int) time.Duration {
	policy = normalizeReconnectPolicy(policy)
	delay := policy.InitialDelayMs
	for i := 0; i < attempt; i++ {
		delay *= 2
		if delay >= policy.MaxDelayMs {
			delay = policy.MaxDelayMs
			break
		}
	}
	return time.Duration(delay) * time.Millisecond
}

func isRetryableResolveError(err error) bool {
	var status HTTPStatusError
	if errors.As(err, &status) {
		return status.Retryable()
	}
	return true
}

func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func nextConnectionID() string {
	return fmt.Sprintf("oec_conn_%d", time.Now().UnixNano())
}

func (b *Broker) emit(status BrokerStatus) {
	if status.UpdatedAt.IsZero() {
		status.UpdatedAt = time.Now().UTC()
	}
	if b.Status != nil {
		b.Status(status)
	}
}
