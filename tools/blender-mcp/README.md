# Blender MCP bridge

Lets a Claude session read and edit a live Blender scene. Vendored from
[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) (MIT, see `LICENSE`).

- `addon.py` — Blender addon v1.8, upstream `main` at `34b7bd2`. Opens a socket on
  `localhost:9876` inside Blender.
- The MCP server is not vendored; `uvx` fetches the `blender-mcp` package on launch.

## Setup (per machine)

1. Register the server at user scope:
   `claude mcp add -s user blender -e DISABLE_TELEMETRY=true -- uvx blender-mcp`
2. In Blender: Edit → Preferences → Add-ons → Install from Disk → this `addon.py`,
   then enable "MCP for Blender".
3. In the 3D viewport press `N`, open the "MCP for Blender" tab, click Connect.
4. Restart the Claude session.

Leave the addon's "Allow Telemetry" preference off: it uploads prompts, code and
screenshots when on.
