package octopusedge

import (
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Services []ServiceConfig `yaml:"services"`
}

type ServiceConfig struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Target      string `yaml:"target"`
}

func LoadConfig(path string) (Config, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return Config{}, errors.New("config path is required")
	}
	data, err := os.ReadFile(trimmed)
	if err != nil {
		return Config{}, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, err
	}
	return cfg, cfg.Validate()
}

func (c Config) Validate() error {
	if len(c.Services) == 0 {
		return errors.New("at least one service is required")
	}
	seen := make(map[string]struct{}, len(c.Services))
	for i, service := range c.Services {
		name := strings.TrimSpace(service.Name)
		if name == "" {
			return fmt.Errorf("services[%d].name is required", i)
		}
		if _, ok := seen[name]; ok {
			return fmt.Errorf("duplicate service name: %s", name)
		}
		seen[name] = struct{}{}
		if err := validateTCPHostPort(service.Target); err != nil {
			return fmt.Errorf("services[%d].target: %w", i, err)
		}
	}
	return nil
}

func (s ServiceConfig) ChannelSpec() ChannelSpec {
	return ChannelSpec{
		Name:        strings.TrimSpace(s.Name),
		Description: strings.TrimSpace(s.Description),
		Target:      strings.TrimSpace(s.Target),
	}
}

func (c Config) ChannelSpecs() []ChannelSpec {
	specs := make([]ChannelSpec, 0, len(c.Services))
	for _, service := range c.Services {
		specs = append(specs, service.ChannelSpec())
	}
	return specs
}

func validateTCPHostPort(value string) error {
	_, _, err := splitTCPHostPort(value)
	return err
}

func splitTCPHostPort(value string) (string, int, error) {
	host, portText, err := net.SplitHostPort(strings.TrimSpace(value))
	if err != nil {
		return "", 0, errors.New("target must be host:port")
	}
	if strings.TrimSpace(host) == "" {
		return "", 0, errors.New("host is required")
	}
	port, err := strconv.Atoi(portText)
	if err != nil || port < 1 || port > 65535 {
		return "", 0, errors.New("port must be between 1 and 65535")
	}
	return strings.TrimSpace(host), port, nil
}
