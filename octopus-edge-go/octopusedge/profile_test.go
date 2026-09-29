package octopusedge

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFileProfileStoreRoundTripWithOwnerOnlyPermissions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "profile.json")
	store := FileProfileStore{Path: path}
	now := time.Now().UTC()
	want := Profile{
		Host:                  "https://manager.autostaff.cn",
		Account:               "https://account.autostaff.cn",
		ClientID:              "oeb_install_1",
		ClientType:            TeamDeviceClientTypeOctopusEdgeBroker,
		DeviceName:            "Office Broker",
		TeamID:                "team_1",
		TeamDeviceID:          "td_1",
		BrokerInstanceID:      "oeb_1",
		BindingCredential:     "oebc_1",
		AccessToken:           "access_1",
		AccessTokenExpiresAt:  now.Add(time.Hour),
		RefreshToken:          "refresh_1",
		RefreshTokenExpiresAt: now.Add(24 * time.Hour),
		BoundAt:               now,
	}

	if err := store.Save(want); err != nil {
		t.Fatalf("save profile: %v", err)
	}
	got, err := store.Load()
	if err != nil {
		t.Fatalf("load profile: %v", err)
	}
	if got.ClientID != want.ClientID || got.TeamDeviceID != want.TeamDeviceID || got.BrokerInstanceID != want.BrokerInstanceID || got.BindingCredential != want.BindingCredential || got.RefreshToken != want.RefreshToken {
		t.Fatalf("unexpected profile: %#v", got)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat profile: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("unexpected profile permissions: %v", info.Mode().Perm())
	}
}

func TestLoadOrNewClientIDPreservesExistingID(t *testing.T) {
	store := FileProfileStore{Path: filepath.Join(t.TempDir(), "profile.json")}
	if err := store.Save(Profile{ClientID: "oeb_existing"}); err != nil {
		t.Fatalf("save profile: %v", err)
	}
	got, err := store.LoadOrNewClientID()
	if err != nil {
		t.Fatalf("load client id: %v", err)
	}
	if got != "oeb_existing" {
		t.Fatalf("unexpected client id: %s", got)
	}
}

func TestFileProfileStoreTightensExistingPermissions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "profile.json")
	if err := os.WriteFile(path, []byte("{}"), 0o644); err != nil {
		t.Fatalf("write profile: %v", err)
	}

	store := FileProfileStore{Path: path}
	if err := store.Save(Profile{ClientID: "oeb_1"}); err != nil {
		t.Fatalf("save profile: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat profile: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("unexpected profile permissions: %v", info.Mode().Perm())
	}
}
