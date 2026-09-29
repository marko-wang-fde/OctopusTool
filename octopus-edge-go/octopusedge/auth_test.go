package octopusedge

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestJCodeClientCreatesSessionWithOctopusEdgeBrokerClientType(t *testing.T) {
	var got createWebAuthHandoffRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/web-auth-handoffs" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		writeData(t, w, JCodeSession{HandoffID: "wah_1", JCode: "12345678", Status: "pending"})
	}))
	defer server.Close()

	client, err := NewJCodeClient(server.URL, "https://host.example.test")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	session, err := client.CreateJCodeSession(context.Background(), CreateJCodeSessionInput{
		ClientID:   "install_1",
		DeviceName: "Office Broker",
		WebBaseURL: " https://app.example.test ",
	})
	if err != nil {
		t.Fatalf("create jcode: %v", err)
	}

	if session.HandoffID != "wah_1" || session.JCode != "12345678" {
		t.Fatalf("unexpected session: %#v", session)
	}
	if got.Kind != "cli_pairing" || got.Audience != "team-device-registration" {
		t.Fatalf("unexpected handoff request: %#v", got)
	}
	if got.WebBaseURL != "https://app.example.test" {
		t.Fatalf("unexpected web base URL: %q", got.WebBaseURL)
	}
	if got.Device.ClientType != TeamDeviceClientTypeOctopusEdgeBroker || got.Device.VisibilityMode != "team_only" {
		t.Fatalf("unexpected device request: %#v", got.Device)
	}
}

func TestJCodeClientWaitsAndExchangesForAccountCredentials(t *testing.T) {
	pollCount := 0
	var exchanged exchangeWebAuthHandoffRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/web-auth-handoffs/wah_1":
			pollCount++
			status := "pending"
			if pollCount == 2 {
				status = "completed"
			}
			writeData(t, w, JCodeSession{HandoffID: "wah_1", JCode: "12345678", Status: status})
		case r.Method == http.MethodPost && r.URL.Path == "/web-auth-handoffs/exchange":
			if err := json.NewDecoder(r.Body).Decode(&exchanged); err != nil {
				t.Fatalf("decode exchange: %v", err)
			}
			writeData(t, w, exchangeWebAuthHandoffResponse{TeamDevice: struct {
				TeamID            string `json:"teamId"`
				TeamDeviceID      string `json:"teamDeviceId"`
				ClientID          string `json:"clientId"`
				ClientType        string `json:"clientType"`
				BrokerInstanceID  string `json:"brokerInstanceId"`
				BindingCredential string `json:"bindingCredential"`
				AccessToken       string `json:"accessToken"`
				RefreshToken      string `json:"refreshToken"`
				ExpiresIn         int64  `json:"expiresIn"`
			}{
				TeamID: "team_1", TeamDeviceID: "td_1", ClientID: "install_1", ClientType: TeamDeviceClientTypeOctopusEdgeBroker,
				BrokerInstanceID: "oeb_1", BindingCredential: "oebc_1", AccessToken: "access_1", RefreshToken: "refresh_1", ExpiresIn: 3600,
			}})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	client, err := NewJCodeClient(server.URL, "https://host.example.test")
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	credentials, err := client.WaitForDeviceCredentials(context.Background(), "wah_1", "12345678", time.Millisecond)
	if err != nil {
		t.Fatalf("wait credentials: %v", err)
	}

	if exchanged.HandoffID != "wah_1" || exchanged.JCode != "12345678" {
		t.Fatalf("unexpected exchange request: %#v", exchanged)
	}
	if credentials.AccessToken != "access_1" || credentials.BrokerInstanceID != "oeb_1" || credentials.BindingCredential != "oebc_1" {
		t.Fatalf("unexpected credentials: %#v", credentials)
	}
	if pollCount != 2 {
		t.Fatalf("unexpected poll count: %d", pollCount)
	}
}

func TestJCodeClientResolvesEndpointThroughTeamDeviceAPI(t *testing.T) {
	now := time.Now().UTC()
	var authHeader string
	var got ResolveEndpointInput
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/team-device/v1/octopus-edge/endpoints:resolve" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		authHeader = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		writeData(t, w, ResolvedEndpoint{
			PublicQuicAddress: "edge.example.test:443",
			ServerName:        "edge.example.test",
			RuntimeClusterKey: "octopus-01",
			RunningInstanceID: "run_1",
			EndpointVersion:   3,
			Credential:        "credential_1",
			CredentialVersion: 5,
			ExpiresAt:         now.Add(5 * time.Minute),
			HeartbeatInterval: 10000,
			ReconnectPolicy:   ReconnectPolicy{InitialDelayMs: 500, MaxDelayMs: 30000},
		})
	}))
	defer server.Close()

	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	resolved, err := client.ResolveEndpoint(context.Background(), "access_1", ResolveEndpointInput{
		BrokerInstanceID:    "oeb_1",
		BindingCredential:   "oebc_1",
		BrokerVersion:       "0.0.1",
		LastEndpointVersion: 2,
	})
	if err != nil {
		t.Fatalf("resolve endpoint: %v", err)
	}
	if authHeader != "Bearer access_1" {
		t.Fatalf("unexpected authorization header: %s", authHeader)
	}
	if got.BrokerInstanceID != "oeb_1" || got.BindingCredential != "oebc_1" || got.BrokerVersion != "0.0.1" || got.LastEndpointVersion != 2 {
		t.Fatalf("unexpected resolve request: %#v", got)
	}
	if resolved.PublicQuicAddress != "edge.example.test:443" || resolved.EndpointVersion != 3 {
		t.Fatalf("unexpected resolved endpoint: %#v", resolved)
	}
}

func TestJCodeClientResolveEndpointIncludesHostErrorBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/team-device/v1/octopus-edge/endpoints:resolve" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"code":"OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND","message":"octopus-edge active binding not found"}}`))
	}))
	defer server.Close()

	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	_, err = client.ResolveEndpoint(context.Background(), "access_1", ResolveEndpointInput{
		BrokerInstanceID:  "oeb_1",
		BindingCredential: "oebc_1",
		BrokerVersion:     "0.0.1",
	})
	if err == nil {
		t.Fatal("expected resolve endpoint error")
	}
	if !strings.Contains(err.Error(), "host returned HTTP 404: OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND: octopus-edge active binding not found") {
		t.Fatalf("expected host error detail, got %q", err.Error())
	}
	var statusErr HTTPStatusError
	if !errors.As(err, &statusErr) {
		t.Fatalf("expected HTTPStatusError, got %T", err)
	}
	if statusErr.Code != "OCTOPUS_EDGE_ACTIVE_BINDING_NOT_FOUND" || !statusErr.Retryable() {
		t.Fatalf("expected retryable active binding error, got %#v", statusErr)
	}
}

func TestJCodeClientSyncsServicesThroughTeamDeviceAPI(t *testing.T) {
	var authHeader string
	var got SyncServicesInput
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/team-device/v1/octopus-edge/services:sync" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		authHeader = r.Header.Get("Authorization")
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request: %v", err)
		}
		if strings.Contains(string(raw), "serviceKey") || strings.Contains(string(raw), "targetHost") || strings.Contains(string(raw), "targetPort") {
			t.Fatalf("sync request leaked local fields: %s", string(raw))
		}
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		writeData(t, w, SyncServicesResult{Items: []SyncedService{
			{EdgeServiceID: "oes_1", Name: "Finance PostgreSQL", Description: "finance database", Status: "active"},
		}})
	}))
	defer server.Close()

	client, err := NewJCodeClient(server.URL, server.URL)
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	result, err := client.SyncServices(context.Background(), "access_1", SyncServicesInput{
		BrokerInstanceID: "oeb_1",
		Services: []ServiceManifestItem{
			{Name: "Finance PostgreSQL", Description: "finance database"},
		},
	})
	if err != nil {
		t.Fatalf("sync services: %v", err)
	}
	if authHeader != "Bearer access_1" {
		t.Fatalf("unexpected authorization header: %s", authHeader)
	}
	if got.BrokerInstanceID != "oeb_1" || len(got.Services) != 1 || got.Services[0].Name != "Finance PostgreSQL" {
		t.Fatalf("unexpected sync request: %#v", got)
	}
	if len(result.Items) != 1 || result.Items[0].EdgeServiceID != "oes_1" {
		t.Fatalf("unexpected sync result: %#v", result)
	}
}

func writeData(t *testing.T, w http.ResponseWriter, data any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
		t.Fatalf("write response: %v", err)
	}
}
