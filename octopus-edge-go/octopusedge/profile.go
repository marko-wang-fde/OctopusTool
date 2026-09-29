package octopusedge

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Profile struct {
	Host                  string    `json:"host"`
	Account               string    `json:"account"`
	ClientID              string    `json:"clientId"`
	ClientType            string    `json:"clientType"`
	DeviceName            string    `json:"deviceName"`
	TeamID                string    `json:"teamId"`
	TeamDeviceID          string    `json:"teamDeviceId"`
	BrokerInstanceID      string    `json:"brokerInstanceId"`
	BindingCredential     string    `json:"bindingCredential"`
	AccessToken           string    `json:"accessToken"`
	AccessTokenExpiresAt  time.Time `json:"accessTokenExpiresAt"`
	RefreshToken          string    `json:"refreshToken"`
	RefreshTokenExpiresAt time.Time `json:"refreshTokenExpiresAt"`
	BoundAt               time.Time `json:"boundAt"`
}

func (p Profile) ValidateForStart() error {
	if strings.TrimSpace(p.Host) == "" {
		return errors.New("profile host is required")
	}
	if strings.TrimSpace(p.Account) == "" {
		return errors.New("profile account is required")
	}
	if strings.TrimSpace(p.ClientID) == "" {
		return errors.New("profile client id is required")
	}
	if strings.TrimSpace(p.TeamID) == "" || strings.TrimSpace(p.TeamDeviceID) == "" {
		return errors.New("profile team device identity is required")
	}
	if strings.TrimSpace(p.BrokerInstanceID) == "" || strings.TrimSpace(p.BindingCredential) == "" {
		return errors.New("profile broker identity is required")
	}
	if strings.TrimSpace(p.RefreshToken) == "" {
		return errors.New("profile refresh token is required")
	}
	return nil
}

type FileProfileStore struct {
	Path string
}

func DefaultProfilePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "octopus-edge", "profile.json"), nil
}

func (s FileProfileStore) Load() (Profile, error) {
	path := strings.TrimSpace(s.Path)
	if path == "" {
		return Profile{}, errors.New("profile path is required")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Profile{}, err
	}
	var profile Profile
	if err := json.Unmarshal(data, &profile); err != nil {
		return Profile{}, err
	}
	return profile, nil
}

func (s FileProfileStore) Save(profile Profile) error {
	path := strings.TrimSpace(s.Path)
	if path == "" {
		return errors.New("profile path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func (s FileProfileStore) LoadOrNewClientID() (string, error) {
	profile, err := s.Load()
	if err == nil && strings.TrimSpace(profile.ClientID) != "" {
		return profile.ClientID, nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	return NewClientID()
}

func NewClientID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "oeb_" + hex.EncodeToString(b[:]), nil
}
