package root

import (
	_ "embed" // Need to embed manifest file
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

//go:embed plugin.json
var manifestString string

var Manifest model.Manifest

func init() {
	if err := json.NewDecoder(strings.NewReader(manifestString)).Decode(&Manifest); err != nil {
		panic(err)
	}
}
