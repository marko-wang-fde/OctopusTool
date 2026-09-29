package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/syngy-ai/octopus-edge-go/octopusedge"
)

func TestRunAuthUsesAccountJCodeAndStoresProfile(t *testing.T) {
	pollCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/web-auth-handoffs":
			var req map[string]any
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatalf("decode request: %v", err)
			}
			if req["audience"] != "team-device-registration" {
				t.Fatalf("unexpected handoff request: %#v", req)
			}
			writeCLIData(t, w, map[string]any{"handoffId": "wah_1", "jcode": "12345678", "status": "pending"})
		case r.Method == http.MethodGet && r.URL.Path == "/web-auth-handoffs/wah_1":
			pollCount++
			writeCLIData(t, w, map[string]any{"handoffId": "wah_1", "jcode": "12345678", "status": "completed"})
		case r.Method == http.MethodPost && r.URL.Path == "/web-auth-handoffs/exchange":
			writeCLIData(t, w, map[string]any{
				"teamDevice": map[string]any{
					"teamId":            "team_1",
					"teamDeviceId":      "td_1",
					"brokerInstanceId":  "oeb_1",
					"bindingCredential": "oebc_1",
					"accessToken":       "access_1",
					"refreshToken":      "refresh_1",
					"expiresIn":         3600,
				},
			})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	profilePath := filepath.Join(t.TempDir(), "profile.json")
	var stdout, stderr bytes.Buffer
	code := Run(context.Background(), []string{
		"auth",
		"--account", server.URL,
		"--host", "https://host.example.test",
		"--name", "Office Broker",
		"--profile", profilePath,
		"--poll-interval", "1ms",
		"--timeout", "1s",
	}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("unexpected exit code %d stderr=%s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "8 digits: 12345678") {
		t.Fatalf("missing 8-digit output: %s", stdout.String())
	}
	if !strings.Contains(stdout.String(), "authenticated team=team_1 teamDevice=td_1") {
		t.Fatalf("missing authenticated output: %s", stdout.String())
	}
	if pollCount != 1 {
		t.Fatalf("unexpected poll count: %d", pollCount)
	}
	data, err := os.ReadFile(profilePath)
	if err != nil {
		t.Fatalf("read profile: %v", err)
	}
	if !strings.Contains(string(data), `"teamDeviceId": "td_1"`) {
		t.Fatalf("profile missing team device id: %s", string(data))
	}
	if !strings.Contains(string(data), `"brokerInstanceId": "oeb_1"`) || !strings.Contains(string(data), `"bindingCredential": "oebc_1"`) {
		t.Fatalf("profile missing broker credentials: %s", string(data))
	}
}

func TestRunStartValidatesProfileAndConfig(t *testing.T) {
	oldRunner := embeddedBrokerRunner
	defer func() { embeddedBrokerRunner = oldRunner }()
	var gotBroker *octopusedge.Broker
	embeddedBrokerRunner = func(ctx context.Context, broker *octopusedge.Broker) error {
		gotBroker = broker
		return nil
	}

	dir := t.TempDir()
	profilePath := filepath.Join(dir, "profile.json")
	configPath := filepath.Join(dir, "edge.yaml")
	now := time.Now().UTC()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected request before embedded broker run: %s %s", r.Method, r.URL.Path)
	}))
	defer server.Close()

	profile := map[string]any{
		"host":                  server.URL,
		"account":               server.URL,
		"clientId":              "oeb_1",
		"clientType":            "octopus-edge-broker",
		"deviceName":            "Office Broker",
		"teamId":                "team_1",
		"teamDeviceId":          "td_1",
		"brokerInstanceId":      "oeb_1",
		"bindingCredential":     "oebc_1",
		"accessToken":           "access_1",
		"accessTokenExpiresAt":  now.Add(time.Hour),
		"refreshToken":          "refresh_1",
		"refreshTokenExpiresAt": now.Add(24 * time.Hour),
		"boundAt":               now,
	}
	data, err := json.Marshal(profile)
	if err != nil {
		t.Fatalf("marshal profile: %v", err)
	}
	if err := os.WriteFile(profilePath, data, 0o600); err != nil {
		t.Fatalf("write profile: %v", err)
	}
	if err := os.WriteFile(configPath, []byte("services:\n  - name: Finance PostgreSQL\n    description: finance database\n    target: 127.0.0.1:5432\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	var stdout, stderr bytes.Buffer
	code := Run(context.Background(), []string{
		"start",
		"-c", configPath,
		"--profile", profilePath,
		"--insecure-skip-server-verification",
	}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("unexpected exit code %d stderr=%s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "validated 1 service(s) for teamDevice=td_1") {
		t.Fatalf("unexpected stdout: %s", stdout.String())
	}
	if gotBroker == nil {
		t.Fatal("embedded broker was not invoked")
	}
	if gotBroker.Profile.Host != server.URL || gotBroker.Profile.TeamID != "team_1" || gotBroker.Profile.BrokerInstanceID != "oeb_1" || gotBroker.Profile.BindingCredential != "oebc_1" {
		t.Fatalf("unexpected broker profile %#v", gotBroker.Profile)
	}
	if len(gotBroker.Services) != 1 || gotBroker.Services[0].Name != "Finance PostgreSQL" || gotBroker.Services[0].Target != "127.0.0.1:5432" {
		t.Fatalf("unexpected broker services %#v", gotBroker.Services)
	}
}

func TestRunVersion(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := Run(context.Background(), []string{"version"}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("unexpected exit code: %d", code)
	}
	if !strings.Contains(stdout.String(), "octopus-edge-cli") {
		t.Fatalf("unexpected stdout: %s", stdout.String())
	}
}

func writeCLIData(t *testing.T, w http.ResponseWriter, data any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
		t.Fatalf("write response: %v", err)
	}
}
