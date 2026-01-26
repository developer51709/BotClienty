# Code Formatting

This project now uses [Prettier](https://prettier.io/) for consistent code formatting across all files.

## Configuration

The Prettier configuration is defined in `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Key formatting rules:

- **Semicolons**: Required at the end of statements
- **Quotes**: Single quotes for strings (except JSX attributes)
- **Line width**: Maximum 100 characters
- **Indentation**: 2 spaces (no tabs)
- **Trailing commas**: ES5-compatible (objects, arrays, etc.)
- **Arrow functions**: Always use parentheses around parameters
- **Line endings**: LF (Unix-style)

## Usage

### Format all files

```bash
npm run format
```

### Check formatting without making changes

```bash
npm run format:check
```

### Format on save (recommended)

Configure your editor to format on save:

#### VS Code

Install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

#### WebStorm/IntelliJ

1. Go to Settings → Languages & Frameworks → JavaScript → Prettier
2. Check "On save"
3. Set Prettier package to `./node_modules/prettier`

## What gets formatted?

All source files are formatted, including:

- TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`)
- CSS files (`.css`)
- JSON files (`.json`)
- Markdown files (`.md`)
- YAML files (`.yml`, `.yaml`)

Files/directories excluded (see `.prettierignore`):

- `node_modules/`
- `.next/`
- `.git/`
- `package-lock.json`
- Build artifacts

## Integration with ESLint

Prettier handles code formatting, while ESLint handles code quality rules. They work together:

- **Prettier**: Formatting (indentation, line breaks, quotes, etc.)
- **ESLint**: Code quality (unused variables, React hooks rules, etc.)

Run both before committing:

```bash
npm run lint && npm run format:check
```

## Pre-commit hook (recommended)

Consider adding a pre-commit hook using [husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged):

```bash
npm install --save-dev husky lint-staged
npx husky init
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,css,md,json}": "prettier --write",
    "*.{ts,tsx,js,jsx}": "eslint --fix"
  }
}
```

Then in `.husky/pre-commit`:

```bash
npx lint-staged
```

## Benefits

- **Consistency**: All code follows the same style
- **No debates**: Formatting rules are automated
- **Faster reviews**: Focus on logic, not style
- **Automatic**: Format on save in your editor
- **Less git noise**: Consistent formatting = fewer diff changes
