package octopusedge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const TeamDeviceClientTypeOctopusEdgeBroker = "octopus-edge-broker"

type JCodeClient struct {
	accountBaseURL string
	hostBaseURL    string
	httpClient     *http.Client
}

type JCodeClientOption func(*JCodeClient)

func WithHTTPClient(client *http.Client) JCodeClientOption {
	return func(c *JCodeClient) {
		if client != nil {
			c.httpClient = client
		}
	}
}

func NewJCodeClient(rawAccount string, rawHost string, opts ...JCodeClientOption) (*JCodeClient, error) {
	accountURL, err := normalizeAbsoluteURL(rawAccount, "account")
	if err != nil {
		return nil, err
	}
	hostURL, err := normalizeAbsoluteURL(rawHost, "host")
	if err != nil {
		return nil, err
	}
	client := &JCodeClient{
		accountBaseURL: accountURL,
		hostBaseURL:    hostURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(client)
	}
	return client, nil
}

func normalizeAbsoluteURL(raw string, name string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		if name == "" {
			name = "url"
		}
		return "", fmt.Errorf("%s is required", name)
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("%s must be an absolute URL: %s", name, trimmed)
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func (c *JCodeClient) HostBaseURL() string {
	return c.hostBaseURL
}

func (c *JCodeClient) AccountBaseURL() string {
	return c.accountBaseURL
}

type CreateJCodeSessionInput struct {
	ClientID      string `json:"clientId"`
	ClientName    string `json:"clientName"`
	ClientType    string `json:"clientType"`
	DeviceName    string `json:"deviceName"`
	WebBaseURL    string `json:"webBaseUrl,omitempty"`
	BrokerVersion string `json:"brokerVersion,omitempty"`
}

type JCodeSession struct {
	HandoffID string     `json:"handoffId"`
	JCode     string     `json:"jcode,omitempty"`
	Status    string     `json:"status"`
	LoginURL  string     `json:"loginUrl,omitempty"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

type DeviceCredentials struct {
	TeamID                string    `json:"teamId"`
	TeamDeviceID          string    `json:"teamDeviceId"`
	AccessToken           string    `json:"accessToken"`
	AccessTokenExpiresAt  time.Time `json:"accessTokenExpiresAt"`
	RefreshToken          string    `json:"refreshToken"`
	RefreshTokenExpiresAt time.Time `json:"refreshTokenExpiresAt"`
	BoundAt               time.Time `json:"boundAt"`
	BrokerInstanceID      string    `json:"brokerInstanceId,omitempty"`
	BindingCredential     string    `json:"bindingCredential,omitempty"`
}

type createWebAuthHandoffRequest struct {
	Kind       string `json:"kind"`
	Audience   string `json:"audience"`
	ClientID   string `json:"clientId"`
	ClientName string `json:"clientName"`
	WebBaseURL string `json:"webBaseUrl,omitempty"`
	Device     struct {
		ClientID       string `json:"clientId"`
		ClientType     string `json:"clientType"`
		DeviceName     string `json:"deviceName"`
		VisibilityMode string `json:"visibilityMode"`
	} `json:"device"`
}

type exchangeWebAuthHandoffRequest struct {
	HandoffID string `json:"handoffId"`
	JCode     string `json:"jcode"`
}

type exchangeWebAuthHandoffResponse struct {
	TeamDevice struct {
		TeamID            string `json:"teamId"`
		TeamDeviceID      string `json:"teamDeviceId"`
		ClientID          string `json:"clientId"`
		ClientType        string `json:"clientType"`
		BrokerInstanceID  string `json:"brokerInstanceId"`
		BindingCredential string `json:"bindingCredential"`
		AccessToken       string `json:"accessToken"`
		RefreshToken      string `json:"refreshToken"`
		ExpiresIn         int64  `json:"expiresIn"`
	} `json:"teamDevice"`
}

type refreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type refreshTokenResponse struct {
	Session struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	} `json:"session"`
}

type ResolveEndpointInput struct {
	BrokerInstanceID    string `json:"brokerInstanceId"`
	BindingCredential   string `json:"bindingCredential"`
	BrokerVersion       string `json:"brokerVersion"`
	LastEndpointVersion int64  `json:"lastEndpointVersion"`
}

type ServiceManifestItem struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type SyncServicesInput struct {
	BrokerInstanceID string                `json:"brokerInstanceId"`
	Services         []ServiceManifestItem `json:"services"`
}

type SyncedService struct {
	EdgeServiceID string `json:"edgeServiceId"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Status        string `json:"status"`
}

type SyncServicesResult struct {
	Items []SyncedService `json:"items"`
}

type ReconnectPolicy struct {
	InitialDelayMs int `json:"initialDelayMs"`
	MaxDelayMs     int `json:"maxDelayMs"`
}

type ResolvedEndpoint struct {
	PublicQuicAddress string          `json:"publicQuicAddress"`
	ServerName        string          `json:"serverName"`
	RuntimeClusterKey string          `json:"runtimeClusterKey"`
	RunningInstanceID string          `json:"runningInstanceId"`
	EndpointVersion   int64           `json:"endpointVersion"`
	Credential        string          `json:"credential"`
	CredentialVersion int64           `json:"credentialVersion"`
	ExpiresAt         time.Time       `json:"expiresAt"`
	HeartbeatInterval int             `json:"heartbeatIntervalMs"`
	ReconnectPolicy   ReconnectPolicy `json:"reconnectPolicy"`
}

func (c *JCodeClient) CreateJCodeSession(ctx context.Context, input CreateJCodeSessionInput) (JCodeSession, error) {
	if strings.TrimSpace(input.ClientID) == "" {
		return JCodeSession{}, errors.New("client id is required")
	}
	if strings.TrimSpace(input.DeviceName) == "" {
		return JCodeSession{}, errors.New("device name is required")
	}
	if strings.TrimSpace(input.ClientType) == "" {
		input.ClientType = TeamDeviceClientTypeOctopusEdgeBroker
	}
	req := createWebAuthHandoffRequest{
		Kind:       "cli_pairing",
		Audience:   "team-device-registration",
		ClientID:   strings.TrimSpace(input.ClientID),
		ClientName: strings.TrimSpace(input.ClientName),
		WebBaseURL: strings.TrimSpace(input.WebBaseURL),
	}
	if req.ClientName == "" {
		req.ClientName = strings.TrimSpace(input.DeviceName)
	}
	req.Device.ClientID = strings.TrimSpace(input.ClientID)
	req.Device.ClientType = strings.TrimSpace(input.ClientType)
	req.Device.DeviceName = strings.TrimSpace(input.DeviceName)
	req.Device.VisibilityMode = "team_only"
	return postJSON[createWebAuthHandoffRequest, JCodeSession](ctx, c.httpClient, c.accountBaseURL+"/web-auth-handoffs", req)
}

func (c *JCodeClient) GetJCodeSession(ctx context.Context, handoffID string) (JCodeSession, error) {
	id := strings.TrimSpace(handoffID)
	if id == "" {
		return JCodeSession{}, errors.New("handoff id is required")
	}
	return getJSON[JCodeSession](ctx, c.httpClient, c.accountBaseURL+"/web-auth-handoffs/"+url.PathEscape(id))
}

func (c *JCodeClient) WaitForDeviceCredentials(ctx context.Context, handoffID string, jcode string, interval time.Duration) (DeviceCredentials, error) {
	if interval <= 0 {
		interval = 2 * time.Second
	}
	timer := time.NewTimer(0)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return DeviceCredentials{}, ctx.Err()
		case <-timer.C:
			session, err := c.GetJCodeSession(ctx, handoffID)
			if err != nil {
				return DeviceCredentials{}, err
			}
			if session.Status == "completed" {
				return c.ExchangeJCodeSession(ctx, handoffID, jcode)
			}
			timer.Reset(interval)
		}
	}
}

func (c *JCodeClient) ExchangeJCodeSession(ctx context.Context, handoffID string, jcode string) (DeviceCredentials, error) {
	id := strings.TrimSpace(handoffID)
	code := strings.TrimSpace(jcode)
	if id == "" || code == "" {
		return DeviceCredentials{}, errors.New("handoff id and 8-digit value are required")
	}
	resp, err := postJSON[exchangeWebAuthHandoffRequest, exchangeWebAuthHandoffResponse](
		ctx,
		c.httpClient,
		c.accountBaseURL+"/web-auth-handoffs/exchange",
		exchangeWebAuthHandoffRequest{HandoffID: id, JCode: code},
	)
	if err != nil {
		return DeviceCredentials{}, err
	}
	expiresAt := time.Now().UTC().Add(time.Duration(resp.TeamDevice.ExpiresIn) * time.Second)
	return DeviceCredentials{
		TeamID:               resp.TeamDevice.TeamID,
		TeamDeviceID:         resp.TeamDevice.TeamDeviceID,
		BrokerInstanceID:     resp.TeamDevice.BrokerInstanceID,
		BindingCredential:    resp.TeamDevice.BindingCredential,
		AccessToken:          resp.TeamDevice.AccessToken,
		AccessTokenExpiresAt: expiresAt,
		RefreshToken:         resp.TeamDevice.RefreshToken,
		BoundAt:              time.Now().UTC(),
	}, nil
}

func (c *JCodeClient) RefreshCredentials(ctx context.Context, refreshToken string) (DeviceCredentials, error) {
	token := strings.TrimSpace(refreshToken)
	if token == "" {
		return DeviceCredentials{}, errors.New("refresh token is required")
	}
	resp, err := postJSON[refreshTokenRequest, refreshTokenResponse](
		ctx,
		c.httpClient,
		c.accountBaseURL+"/auth/v1/token?grant_type=refresh_token",
		refreshTokenRequest{RefreshToken: token},
	)
	if err != nil {
		return DeviceCredentials{}, err
	}
	expiresAt := time.Now().UTC().Add(time.Duration(resp.Session.ExpiresIn) * time.Second)
	return DeviceCredentials{
		AccessToken:          resp.Session.AccessToken,
		AccessTokenExpiresAt: expiresAt,
		RefreshToken:         resp.Session.RefreshToken,
	}, nil
}

func (c *JCodeClient) ResolveEndpoint(ctx context.Context, accessToken string, input ResolveEndpointInput) (ResolvedEndpoint, error) {
	if strings.TrimSpace(accessToken) == "" {
		return ResolvedEndpoint{}, errors.New("access token is required")
	}
	if strings.TrimSpace(input.BrokerInstanceID) == "" || strings.TrimSpace(input.BindingCredential) == "" || strings.TrimSpace(input.BrokerVersion) == "" {
		return ResolvedEndpoint{}, errors.New("broker instance id, binding credential and broker version are required")
	}
	return postJSONWithHeaders[ResolveEndpointInput, ResolvedEndpoint](
		ctx,
		c.httpClient,
		c.hostBaseURL+"/team-device/v1/octopus-edge/endpoints:resolve",
		input,
		map[string]string{"Authorization": "Bearer " + strings.TrimSpace(accessToken)},
	)
}

func (c *JCodeClient) SyncServices(ctx context.Context, accessToken string, input SyncServicesInput) (SyncServicesResult, error) {
	if strings.TrimSpace(accessToken) == "" {
		return SyncServicesResult{}, errors.New("access token is required")
	}
	if strings.TrimSpace(input.BrokerInstanceID) == "" {
		return SyncServicesResult{}, errors.New("broker instance id is required")
	}
	if len(input.Services) == 0 {
		return SyncServicesResult{}, errors.New("at least one service is required")
	}
	for i, service := range input.Services {
		if strings.TrimSpace(service.Name) == "" {
			return SyncServicesResult{}, fmt.Errorf("services[%d] name is required", i)
		}
	}
	return postJSONWithHeaders[SyncServicesInput, SyncServicesResult](
		ctx,
		c.httpClient,
		c.hostBaseURL+"/team-device/v1/octopus-edge/services:sync",
		input,
		map[string]string{"Authorization": "Bearer " + strings.TrimSpace(accessToken)},
	)
}

type pinEnvelope[T any] struct {
	Data  T           `json:"data"`
	Error interface{} `json:"error,omitempty"`
}

type HTTPStatusError struct {
	StatusCode int
	Status     string
	Code       string
	Detail     string
}

func (e HTTPStatusError) Error() string {
	detail := strings.TrimSpace(e.Detail)
	if detail == "" {
		return fmt.Sprintf("host returned HTTP %d", e.StatusCode)
	}
	return fmt.Sprintf("host returned HTTP %d: %s", e.StatusCode, detail)
}

func (e HTTPStatusError) Retryable() bool {
	if e.StatusCode >= 500 {
		return true
	}
	switch strings.TrimSpace(e.Code) {
	case "OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND",
		"OCTOPUS_EDGE_RUNTIME_ENDPOINT_NOT_CONFIGURED":
		return true
	default:
		return false
	}
}

func postJSON[In any, Out any](ctx context.Context, client *http.Client, endpoint string, input In) (Out, error) {
	return postJSONWithHeaders[In, Out](ctx, client, endpoint, input, nil)
}

func postJSONWithHeaders[In any, Out any](ctx context.Context, client *http.Client, endpoint string, input In, headers map[string]string) (Out, error) {
	var zero Out
	payload, err := json.Marshal(input)
	if err != nil {
		return zero, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return zero, err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	return doJSON[Out](client, req)
}

func getJSON[Out any](ctx context.Context, client *http.Client, endpoint string) (Out, error) {
	var zero Out
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return zero, err
	}
	return doJSON[Out](client, req)
}

func doJSON[Out any](client *http.Client, req *http.Request) (Out, error) {
	var zero Out
	resp, err := client.Do(req)
	if err != nil {
		return zero, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		code, detail := parseHTTPErrorBody(raw)
		return zero, HTTPStatusError{StatusCode: resp.StatusCode, Status: resp.Status, Code: code, Detail: detail}
	}
	var envelope pinEnvelope[Out]
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return zero, err
	}
	if envelope.Error != nil {
		return zero, fmt.Errorf("host returned error: %v", envelope.Error)
	}
	return envelope.Data, nil
}

func parseHTTPErrorBody(raw []byte) (string, string) {
	body := strings.TrimSpace(string(raw))
	if body == "" {
		return "", ""
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", body
	}
	errorValue, ok := payload["error"]
	if !ok || errorValue == nil {
		return "", body
	}
	switch value := errorValue.(type) {
	case string:
		return "", strings.TrimSpace(value)
	case map[string]any:
		code := strings.TrimSpace(stringValue(value["code"]))
		message := strings.TrimSpace(stringValue(value["message"]))
		if code != "" && message != "" {
			return code, code + ": " + message
		}
		if code != "" {
			return code, code
		}
		return "", message
	default:
		return "", body
	}
}

func stringValue(raw any) string {
	if value, ok := raw.(string); ok {
		return value
	}
	return ""
}
