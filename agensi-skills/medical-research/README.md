# Medical research

Looks up public drug, trial, guideline, literature, and WHO records. It is source lookup, not diagnosis or treatment.

No API key is required for the tools this skill uses. Paid ranking keys stay off unless the buyer sets them on the server themselves.

## Connect

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "npx",
      "args": ["-y", "medical-mcp"]
    }
  }
}
```

## Package this listing

```bash
cd agensi-skills
zip -r medical-research.zip medical-research -x "*.DS_Store"
```

Upload `medical-research.zip` in the Agensi creator dashboard. This repository does not submit the listing.
