package octopusedge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestBrokerSyncTargetsDoesNotLeakLocalTargetFields(t *testing.T) {
	var rawRequest bytes.Buffer
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/team-device/v1/octopus-edge/services:sync" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if _, err := rawRequest.ReadFrom(r.Body); err != nil {
			t.Fatal(err)
		}
		writeBrokerData(t, w, SyncServicesResult{Items: []SyncedService{{
			EdgeServiceID: "oes_1",
			Name:          "SyngyLink SPK Proxy Base",
			Status:        "active",
		}}})
	}))
	defer server.Close()
	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	broker := Broker{Services: []ChannelSpec{{
		Name:        "SyngyLink SPK Proxy Base",
		Description: "proxy",
		Target:      "127.0.0.1:8792",
	}}}
	targets, err := broker.syncTargets(context.Background(), client, Profile{
		BrokerInstanceID: "oeb_1",
		AccessToken:      "access_1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if raw := rawRequest.String(); strings.Contains(raw, "127.0.0.1") || strings.Contains(raw, "8792") || strings.Contains(raw, "targetHost") || strings.Contains(raw, "targetPort") {
		t.Fatalf("service sync leaked local target: %s", raw)
	}
	if targets["oes_1"].addr != "127.0.0.1:8792" {
		t.Fatalf("unexpected targets %#v", targets)
	}
}

func TestBrokerRetriesEndpointResolveWithBackoffForServerErrors(t *testing.T) {
	resolveCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team-device/v1/octopus-edge/services:sync":
			writeBrokerData(t, w, SyncServicesResult{Items: []SyncedService{{
				EdgeServiceID: "oes_1",
				Name:          "svc",
				Status:        "active",
			}}})
		case "/team-device/v1/octopus-edge/endpoints:resolve":
			resolveCount++
			http.Error(w, "temporary", http.StatusInternalServerError)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	var delays []time.Duration
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	broker := Broker{
		Profile: testBrokerProfile(server.URL),
		Services: []ChannelSpec{{
			Name:   "svc",
			Target: "127.0.0.1:8792",
		}},
		Client: client,
		Sleep: func(ctx context.Context, d time.Duration) error {
			delays = append(delays, d)
			cancel()
			return ctx.Err()
		},
	}
	err = broker.Run(ctx)
	if err == nil {
		t.Fatal("expected cancelled retry")
	}
	if resolveCount != 1 || len(delays) != 1 || delays[0] != time.Second {
		t.Fatalf("unexpected retry behavior resolveCount=%d delays=%v", resolveCount, delays)
	}
}

func TestBrokerRetriesEndpointResolveActiveBindingNotReady(t *testing.T) {
	resolveCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team-device/v1/octopus-edge/services:sync":
			writeBrokerData(t, w, SyncServicesResult{Items: []SyncedService{{
				EdgeServiceID: "oes_1",
				Name:          "svc",
				Status:        "active",
			}}})
		case "/team-device/v1/octopus-edge/endpoints:resolve":
			resolveCount++
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"code":"OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND","message":"octopus-edge active binding not found"}}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	var delays []time.Duration
	var statusErrors []string
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	broker := Broker{
		Profile: testBrokerProfile(server.URL),
		Services: []ChannelSpec{{
			Name:   "svc",
			Target: "127.0.0.1:8792",
		}},
		Client: client,
		Sleep: func(ctx context.Context, d time.Duration) error {
			delays = append(delays, d)
			cancel()
			return ctx.Err()
		},
		Status: func(status BrokerStatus) {
			if status.LastError != "" {
				statusErrors = append(statusErrors, status.LastError)
			}
		},
	}
	err = broker.Run(ctx)
	if err == nil {
		t.Fatal("expected cancelled retry")
	}
	if resolveCount != 1 || len(delays) != 1 || delays[0] != time.Second {
		t.Fatalf("unexpected retry behavior resolveCount=%d delays=%v", resolveCount, delays)
	}
	if len(statusErrors) == 0 || !strings.Contains(statusErrors[len(statusErrors)-1], "OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND") {
		t.Fatalf("expected active binding host error in status, got %#v", statusErrors)
	}
}

func TestBrokerFastFailsEndpointResolveClientError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team-device/v1/octopus-edge/services:sync":
			writeBrokerData(t, w, SyncServicesResult{Items: []SyncedService{{
				EdgeServiceID: "oes_1",
				Name:          "svc",
				Status:        "active",
			}}})
		case "/team-device/v1/octopus-edge/endpoints:resolve":
			http.Error(w, "revoked", http.StatusForbidden)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	broker := Broker{
		Profile:  testBrokerProfile(server.URL),
		Services: []ChannelSpec{{Name: "svc", Target: "127.0.0.1:8792"}},
		Client:   client,
		Sleep: func(ctx context.Context, d time.Duration) error {
			t.Fatalf("client error must not retry")
			return nil
		},
	}
	err = broker.Run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "HTTP 403") {
		t.Fatalf("expected HTTP 403 fast-fail, got %v", err)
	}
}

func TestBrokerKeepsAcceptedGatewayConnectionUntilContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	conn := newBlockingGatewayConnection(ctx)
	broker := Broker{
		Profile: testBrokerProfile("http://host.test"),
		Status: func(status BrokerStatus) {
			if status.State == "online" && status.Running {
				cancel()
			}
		},
	}
	endpoint := ResolvedEndpoint{
		PublicQuicAddress: "edge.test:7443",
		ServerName:        "edge.test",
		RuntimeClusterKey: "octc_local_dev",
		RunningInstanceID: "local-dev-runtime",
		EndpointVersion:   2,
		CredentialVersion: 2,
		Credential:        "credential",
		HeartbeatInterval: 30000,
	}
	err := broker.connectAndServe(ctx, fakeGatewayDialer{conn: conn}, nil, broker.Profile, "test", endpoint, map[string]brokerTarget{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if !conn.closedWithError {
		t.Fatal("expected broker to close gateway connection on exit")
	}
}

func TestBrokerDoesNotReattachOnHeartbeatInterval(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	conn := newBlockingGatewayConnection(ctx)
	var online sync.Once
	broker := Broker{
		Profile: testBrokerProfile("http://host.test"),
		Status: func(status BrokerStatus) {
			if status.State == "online" && status.Running {
				online.Do(func() {
					go func() {
						time.Sleep(25 * time.Millisecond)
						cancel()
					}()
				})
			}
		},
	}
	endpoint := ResolvedEndpoint{
		PublicQuicAddress: "edge.test:7443",
		ServerName:        "edge.test",
		RuntimeClusterKey: "octc_local_dev",
		RunningInstanceID: "local-dev-runtime",
		EndpointVersion:   2,
		CredentialVersion: 2,
		Credential:        "credential",
		HeartbeatInterval: 1,
	}
	startedAt := time.Now()
	err := broker.connectAndServe(ctx, fakeGatewayDialer{conn: conn}, nil, broker.Profile, "test", endpoint, map[string]brokerTarget{})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if time.Since(startedAt) < 20*time.Millisecond {
		t.Fatal("broker exited before context cancellation window")
	}
	if conn.closeReason == "broker reattach interval elapsed" {
		t.Fatal("broker must not proactively reattach on heartbeat interval")
	}
}

func TestDefaultQUICConfigUsesHeartbeatFreshnessWindow(t *testing.T) {
	config := defaultQUICConfig(ResolvedEndpoint{HeartbeatInterval: 10_000})
	if config.MaxIdleTimeout != 30*time.Second {
		t.Fatalf("expected three heartbeat intervals before idle close, got %s", config.MaxIdleTimeout)
	}
	if config.KeepAlivePeriod != 10*time.Second {
		t.Fatalf("expected keepalive at heartbeat interval, got %s", config.KeepAlivePeriod)
	}
}

func TestDefaultQUICConfigHasMinimumIdleWindow(t *testing.T) {
	config := defaultQUICConfig(ResolvedEndpoint{HeartbeatInterval: 1})
	if config.MaxIdleTimeout != 15*time.Second {
		t.Fatalf("expected minimum idle close window, got %s", config.MaxIdleTimeout)
	}
	if config.KeepAlivePeriod != time.Millisecond {
		t.Fatalf("expected short keepalive period, got %s", config.KeepAlivePeriod)
	}
}

func TestBrokerResolvesFreshEndpointAfterGatewayConnectionLoss(t *testing.T) {
	var resolveLastVersions []int64
	resolveCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/team-device/v1/octopus-edge/services:sync":
			writeBrokerData(t, w, SyncServicesResult{Items: []SyncedService{{
				EdgeServiceID: "oes_1",
				Name:          "svc",
				Status:        "active",
			}}})
		case "/team-device/v1/octopus-edge/endpoints:resolve":
			var req ResolveEndpointInput
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatal(err)
			}
			resolveLastVersions = append(resolveLastVersions, req.LastEndpointVersion)
			resolveCount++
			endpoint := ResolvedEndpoint{
				PublicQuicAddress: "edge-old.test:7443",
				ServerName:        "edge-old.test",
				RuntimeClusterKey: "octc_local_dev",
				RunningInstanceID: "local-dev-runtime",
				EndpointVersion:   11,
				CredentialVersion: 1,
				Credential:        "credential-old",
				HeartbeatInterval: 30000,
				ReconnectPolicy:   ReconnectPolicy{InitialDelayMs: 1, MaxDelayMs: 1},
			}
			if resolveCount == 2 {
				endpoint.PublicQuicAddress = "edge-new.test:7443"
				endpoint.ServerName = "edge-new.test"
				endpoint.EndpointVersion = 12
				endpoint.Credential = "credential-new"
			}
			writeBrokerData(t, w, endpoint)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	dialer := &sequenceGatewayDialer{conns: []GatewayConnection{
		&failingAcceptGatewayConnection{err: errors.New("simulated network drop")},
		newBlockingGatewayConnection(ctx),
	}}
	var delays []time.Duration
	var onlineVersions []int64
	broker := Broker{
		Profile:  testBrokerProfile(server.URL),
		Services: []ChannelSpec{{Name: "svc", Target: "127.0.0.1:8792"}},
		Client:   client,
		Dialer:   dialer,
		Sleep: func(ctx context.Context, d time.Duration) error {
			delays = append(delays, d)
			return nil
		},
		Status: func(status BrokerStatus) {
			if status.State == "online" && status.Running {
				onlineVersions = append(onlineVersions, status.EndpointVersion)
				if status.EndpointVersion == 12 {
					cancel()
				}
			}
		},
	}
	err = broker.Run(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation after reconnect, got %v", err)
	}
	if len(resolveLastVersions) != 2 || resolveLastVersions[0] != 0 || resolveLastVersions[1] != 11 {
		t.Fatalf("expected fresh resolve with last endpoint version, got %#v", resolveLastVersions)
	}
	if len(delays) != 1 || delays[0] != time.Millisecond {
		t.Fatalf("expected one reconnect backoff, got %#v", delays)
	}
	if len(dialer.endpoints) != 2 || dialer.endpoints[0].PublicQuicAddress != "edge-old.test:7443" || dialer.endpoints[1].PublicQuicAddress != "edge-new.test:7443" {
		t.Fatalf("expected reconnect to fresh endpoint, got %#v", dialer.endpoints)
	}
	if len(onlineVersions) < 2 || onlineVersions[0] != 11 || onlineVersions[len(onlineVersions)-1] != 12 {
		t.Fatalf("expected online statuses for old then new endpoint, got %#v", onlineVersions)
	}
}

func TestHandleGatewaySessionDialsMappedTargetAndPipesBytes(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		buf := make([]byte, 4)
		if _, err := conn.Read(buf); err != nil {
			return
		}
		_, _ = conn.Write([]byte("pong"))
	}()
	open := GatewaySessionOpen{
		MessageType:                     "gatewaySessionOpen",
		StreamID:                        "stream_1",
		SessionID:                       "session_1",
		TeamID:                          "team_1",
		EdgeServiceID:                   "oes_1",
		TeamBandwidthLimitBitsPerSecond: 1,
	}
	line, err := json.Marshal(open)
	if err != nil {
		t.Fatal(err)
	}
	stream := &readWriteBuffer{reader: bytes.NewReader(append(append(line, '\n'), []byte("ping")...))}
	targets := map[string]brokerTarget{"oes_1": {addr: listener.Addr().String()}}
	var nd net.Dialer
	if err := handleGatewaySession(context.Background(), stream, targets, nd.DialContext); err != nil {
		t.Fatal(err)
	}
	if got := stream.String(); got != "pong" {
		t.Fatalf("unexpected response %q", got)
	}
}

type readWriteBuffer struct {
	reader *bytes.Reader
	writer bytes.Buffer
}

func (b *readWriteBuffer) Read(p []byte) (int, error) {
	return b.reader.Read(p)
}

func (b *readWriteBuffer) Write(p []byte) (int, error) {
	return b.writer.Write(p)
}

func (b *readWriteBuffer) String() string {
	return b.writer.String()
}

type fakeGatewayDialer struct {
	conn GatewayConnection
}

func (d fakeGatewayDialer) DialGateway(context.Context, ResolvedEndpoint) (GatewayConnection, error) {
	return d.conn, nil
}

type sequenceGatewayDialer struct {
	conns     []GatewayConnection
	endpoints []ResolvedEndpoint
}

func (d *sequenceGatewayDialer) DialGateway(_ context.Context, endpoint ResolvedEndpoint) (GatewayConnection, error) {
	d.endpoints = append(d.endpoints, endpoint)
	if len(d.conns) == 0 {
		return nil, errors.New("unexpected gateway dial")
	}
	conn := d.conns[0]
	d.conns = d.conns[1:]
	return conn, nil
}

type failingAcceptGatewayConnection struct {
	err         error
	closeReason string
	closed      chan error
}

func (c *failingAcceptGatewayConnection) OpenAttachStream(context.Context) (io.ReadWriteCloser, error) {
	return &readWriteCloserBuffer{reader: bytes.NewReader([]byte(`{"type":"gatewayBrokerAttachAccepted"}` + "\n"))}, nil
}

func (c *failingAcceptGatewayConnection) AcceptSessionStream(context.Context) (io.ReadWriteCloser, error) {
	if c.err != nil {
		return nil, c.err
	}
	return nil, errors.New("simulated gateway stream failure")
}

func (c *failingAcceptGatewayConnection) Closed() <-chan error {
	if c.closed == nil {
		c.closed = make(chan error)
	}
	return c.closed
}

func (c *failingAcceptGatewayConnection) CloseWithError(_ uint64, reason string) error {
	c.closeReason = reason
	return nil
}

type blockingGatewayConnection struct {
	ctx             context.Context
	closed          chan error
	closedWithError bool
	closeReason     string
}

func newBlockingGatewayConnection(ctx context.Context) *blockingGatewayConnection {
	return &blockingGatewayConnection{ctx: ctx, closed: make(chan error)}
}

func (c *blockingGatewayConnection) OpenAttachStream(context.Context) (io.ReadWriteCloser, error) {
	return &readWriteCloserBuffer{reader: bytes.NewReader([]byte(`{"type":"gatewayBrokerAttachAccepted"}` + "\n"))}, nil
}

func (c *blockingGatewayConnection) AcceptSessionStream(context.Context) (io.ReadWriteCloser, error) {
	<-c.ctx.Done()
	return nil, c.ctx.Err()
}

func (c *blockingGatewayConnection) Closed() <-chan error {
	return c.closed
}

func (c *blockingGatewayConnection) CloseWithError(_ uint64, reason string) error {
	c.closedWithError = true
	c.closeReason = reason
	return nil
}

type readWriteCloserBuffer struct {
	reader *bytes.Reader
	writer bytes.Buffer
}

func (b *readWriteCloserBuffer) Read(p []byte) (int, error) {
	return b.reader.Read(p)
}

func (b *readWriteCloserBuffer) Write(p []byte) (int, error) {
	return b.writer.Write(p)
}

func (b *readWriteCloserBuffer) Close() error {
	return nil
}

func testBrokerProfile(host string) Profile {
	return Profile{
		Host:                  host,
		Account:               host,
		ClientID:              "synology-spk",
		TeamID:                "team_1",
		TeamDeviceID:          "td_1",
		BrokerInstanceID:      "oeb_1",
		BindingCredential:     "binding_1",
		AccessToken:           "access_1",
		AccessTokenExpiresAt:  time.Now().Add(time.Hour),
		RefreshToken:          "refresh_1",
		RefreshTokenExpiresAt: time.Now().Add(time.Hour),
		BoundAt:               time.Now(),
	}
}

func writeBrokerData(t *testing.T, w http.ResponseWriter, data any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
		t.Fatal(err)
	}
}
