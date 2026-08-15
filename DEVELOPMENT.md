# Development Guide

This guide covers local development setup for dsh-tui-pro.

## Prerequisites

- Node.js >= 22.19.0 or >= 24.0.0
- pnpm >= 8.0.0
- A working DeepSeek Harness installation (for integration testing)

## Initial Setup

### 1. Clone the repository

```bash
git clone https://github.com/lk251066/dsh-tui-pro.git
cd dsh-tui-pro
```

### 2. Bootstrap dependencies

The TUI plugin depends on `@deepseek-ai/dsh-*` packages. We provide pre-packaged tarballs in `.tarballs/` for offline development.

```bash
pnpm install
```

### 3. Build the plugin

```bash
pnpm build
```

This compiles TypeScript sources in `packages/dsh-tui/src/` to `packages/dsh-tui/lib/`.

## Development Workflow

### Option A: Link to Local Harness (Recommended)

If you have a local DeepSeek Harness checkout for testing:

1. **Add workspace reference** in the harness's `pnpm-workspace.yaml`:

   ```yaml
   packages:
     - packages/*/*
     - ../dsh-tui-pro  # Add this line
   ```

2. **Change dependency in harness** from tarball to workspace protocol in `package.json`:

   ```json
   {
     "dependencies": {
       "@lk251066/dsh-tui": "workspace:*"
     }
   }
   ```

3. **Install** to create symlink:

   ```bash
   cd /path/to/deepseek-harness
   pnpm install
   ```

4. **Edit and rebuild**:

   ```bash
   cd /path/to/dsh-tui-pro
   # Edit files in packages/dsh-tui/src/
   pnpm build
   
   # Test immediately in harness
   cd /path/to/deepseek-harness
   pnpm dsh --profile tui
   ```

### Option B: Pack and Install

For testing the published artifact format:

```bash
cd dsh-tui-pro
pnpm pack --pack-destination .

# Install in harness
cd /path/to/deepseek-harness
pnpm add ../dsh-tui-pro/lk251066-dsh-tui-1.0.0.tgz
```

## Project Structure

```
dsh-tui-pro/
├── packages/
│   └── dsh-tui/              # Main TUI plugin package
│       ├── src/              # TypeScript sources
│       │   ├── index.ts      # Plugin entry (apply, inject, name)
│       │   ├── config.ts     # Configuration schema
│       │   ├── invariant.ts  # Runtime invariant checks (separate plugin)
│       │   ├── prompt.ts     # Prompt template service (separate plugin)
│       │   ├── runtime.ts    # Runtime interfaces
│       │   ├── chat/         # Session management logic
│       │   ├── components/   # UI components (pi-tui based)
│       │   └── extension/    # Extension API (overlay manager)
│       ├── lib/              # Build output
│       ├── tests/            # Unit tests
│       ├── cordis.patch.yml  # Bundle patch configuration
│       └── package.json
├── .tarballs/                # Pre-packaged peer dependencies
├── .scripts/                 # Build and release scripts
└── patches/                  # pnpm patches for dependencies
```

## Key Dependencies

### Peer Dependencies (provided by harness)

These must be available in the host harness at runtime:

- `@deepseek-ai/cordis` - Plugin framework
- `@deepseek-ai/dsh-agent` - Agent lifecycle
- `@deepseek-ai/dsh-session` - Session model
- `@deepseek-ai/dsh-llm` - LLM messages
- `@deepseek-ai/dsh-commands` - Command registry
- ... (see `package.json` for full list)

### Direct Dependencies (bundled)

- `@earendil-works/pi-tui@0.80.7` - Terminal UI framework
- `cli-highlight` - Code syntax highlighting
- `diff` - Diff algorithm
- `saxes` - XML parsing
- `schemastery` - Config validation

## Testing

### Unit Tests

```bash
pnpm test
```

### Integration Test with Real Harness

```bash
# Start TUI with your local changes
cd /path/to/deepseek-harness
pnpm dsh --profile tui

# Or with debugging
DEBUG=dsh:* pnpm dsh --profile tui
```

### ConPTY Smoke Test

For Windows ConPTY compatibility testing:

```bash
node .test-native-tui.cjs
```

Expected output:
```
✅ Banner rendered
✅ Input prompt ready
✅ No crash
```

## Common Issues

### "Cannot find module '@lk251066/dsh-tui'"

- Check that `apps/cli/package.json` in the harness includes `@lk251066/dsh-tui` as a dependency
- The `healProfilesModuleFallback` function only symlinks packages in the CLI app's dependency closure

### "Module is not a valid Cordis plugin"

- Verify `dsh` field exists in `package.json`:
  ```json
  {
    "dsh": {
      "bundle": {
        "patch": "./cordis.patch.yml"
      }
    }
  }
  ```

### Type Errors After Upstream Changes

- Rebuild tarballs from upstream:
  ```bash
  cd /path/to/deepseek-harness
  pnpm pack --pack-destination /path/to/dsh-tui-pro/.tarballs
  ```
- Update `devDependencies` paths in `packages/dsh-tui/package.json`

## Release Process

### 1. Version Bump

```bash
cd packages/dsh-tui
npm version patch  # or minor/major
```

### 2. Build and Test

```bash
pnpm build
pnpm test
```

### 3. Publish to npm

```bash
cd packages/dsh-tui
npm publish --access public
```

### 4. Tag Release

```bash
git tag v1.0.1
git push origin v1.0.1
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `pnpm build && pnpm test`
6. Submit a pull request

## License

MIT
