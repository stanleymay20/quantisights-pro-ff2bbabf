# 🔒 Quantivis Security & Quality Setup Guide

This guide walks through all the security and code quality improvements made to the project.

## ✅ What was Fixed

### 1. **Security Issues** 🔴
- ✅ Updated `.gitignore` to prevent accidentally committing `.env` files
- ✅ Enabled strict TypeScript (`strict: true`, `noImplicitAny: true`, etc.)
- ✅ Removed console logs that could leak sensitive information
- ✅ Created logging service to replace console output

### 2. **Code Quality** 🟡
- ✅ Created structured error handling utilities
- ✅ Added type-safe API error handling
- ✅ Implemented validation helper functions
- ✅ Created comprehensive test examples

### 3. **Developer Tools** 🟢
- ✅ Set up GitHub Actions CI/CD pipeline
- ✅ Created pre-commit hooks configuration (Husky)
- ✅ Created security best practices guide
- ✅ Added test utilities and test suite

## 📦 Installation & Setup

### 1. Install Pre-commit Hooks

```bash
# Install Husky
bun add -D husky
bun exec husky install

# Make scripts executable (on macOS/Linux)
chmod +x .husky/pre-commit.sh
chmod +x .husky/pre-push.sh

# On Windows (run in Git Bash or WSL)
git config core.hooksPath .husky
```

### 2. Update package.json

Add this to your `package.json`:

```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

Then run once:
```bash
bun run prepare
```

### 3. Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

### 4. Configure Git Secrets Detection (Optional)

```bash
# Install git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# Configure detection patterns
git secrets --register-aws
git secrets --add 'SUPABASE.*KEY'
git secrets --add 'STRIPE_KEY'

# Test it works
git secrets --scan
```

## 🚀 Development Workflow

### Before Committing
```bash
# Pre-commit hook runs automatically:
# - ESLint with fixes
# - TypeScript type checking

# If hooks fail, fix issues and try again
git add .
git commit -m "Fix TypeScript errors"
```

### Before Pushing
```bash
# Pre-push hook runs automatically:
# - Unit tests
# - Full build

# Tests must pass before pushing
```

### Manual Checks
```bash
# Run linter manually
bun run lint
bun run lint --fix  # Auto-fix issues

# Type check
bun run tsc --noEmit

# Run tests
bun run test
bun run test:watch

# Build
bun run build
```

## 🔐 Security Checklist

### Daily Development
- [ ] Never commit `.env` files
- [ ] Use `import.meta.env.VITE_*` for environment variables
- [ ] Validate all user input using `validateRequired()` or custom validation
- [ ] Use structured logger instead of `console.log()`

### Before Committing
- [ ] Review changes for accidentally committed secrets
- [ ] Ensure no hardcoded API keys or passwords
- [ ] Check that error messages don't leak sensitive info

### Code Review
- [ ] Verify input validation on all API endpoints
- [ ] Check RLS policies on database queries
- [ ] Ensure errors are handled safely
- [ ] Confirm logs don't expose user data

## 📝 Using New Utilities

### Logging Service

Replace all `console.log()` with the logger:

```typescript
// Before ❌
console.error('User creation failed:', err);

// After ✅
import { logger } from '@/lib/logger';
logger.error('User creation failed', err, {
  userId: user.id,
  operation: 'createUser'
});
```

### Error Handling

Use `handleAsync` for all async operations:

```typescript
// Before ❌
try {
  const data = await fetchUserData(id);
  setUser(data);
} catch (err: any) {
  console.error(err);
  setError(err.message);
}

// After ✅
import { handleAsync, parseAPIError } from '@/lib/error-handler';

const [data, error] = await handleAsync(
  fetchUserData(id),
  { operation: 'fetchUserData', metadata: { userId: id } }
);

if (error) {
  const { message } = parseAPIError(error);
  setError(message); // Safe error message
} else {
  setUser(data);
}
```

### Input Validation

```typescript
// Before ❌
function createDecision(data: any) {
  db.insert({
    title: data.title,
    userId: data.userId,
  });
}

// After ✅
import { validateRequired } from '@/lib/error-handler';

function createDecision(data: unknown) {
  const typed = data as any;
  validateRequired(typed, ['title', 'userId']);
  
  db.insert({
    title: typed.title,
    userId: typed.userId,
  });
}
```

## 🧪 Writing Tests

Use test utilities:

```typescript
import { describe, it, expect } from 'vitest';
import { setupTestEnv, mockUser, expectAsync } from '@/test/test-utils';

setupTestEnv();

describe('Decision Service', () => {
  it('should create a decision', async () => {
    const [result, error] = await expectAsync(
      createDecision({ title: 'Test', userId: mockUser.id })
    );
    expect(error).toBeNull();
    expect(result?.id).toBeDefined();
  });

  it('should validate required fields', () => {
    expect(() => {
      createDecision({ title: 'Test' }); // Missing userId
    }).toThrow();
  });
});
```

## 🔍 Monitoring & Observability

### Setting Up Error Tracking

Configure Sentry or similar service:

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
});
```

The logger will automatically send errors to configured services.

## 📚 Key Files Added

| File | Purpose |
|------|---------|
| `src/lib/logger.ts` | Structured logging service |
| `src/lib/error-handler.ts` | Type-safe error handling |
| `.github/workflows/ci.yml` | GitHub Actions CI/CD |
| `.husky/pre-commit.sh` | Pre-commit hook script |
| `.husky/pre-push.sh` | Pre-push hook script |
| `SECURITY.md` | Security best practices guide |
| `src/test/test-utils.ts` | Test helper functions |
| `src/test/logger.test.ts` | Logger unit tests |
| `src/test/error-handler.test.ts` | Error handler unit tests |

## ⚠️ Breaking Changes

1. **TypeScript Strict Mode**: May reveal type errors in existing code
   - Fix: Add proper type annotations or enable specific rules gradually
   
2. **Removed Console Logs**: Debug output will go to logger only
   - Fix: Use logger service for structured logging
   
3. **.env Protection**: Local development must use `.env.local`
   - Fix: Ensure `.env.local` is added to `.gitignore`

## 🆘 Troubleshooting

### Pre-commit hook not running
```bash
# Check hook installation
ls -la .husky/

# Re-install hooks
bun add -D husky
bun exec husky install
```

### "Cannot find module" errors after changes
```bash
# TypeScript check failing?
bun run tsc --noEmit

# Clear cache and rebuild
rm -rf node_modules dist
bun install
bun run build
```

### Secrets detected falsely
Check `.gitignore` and configure git-secrets properly:
```bash
git secrets --scan-history
```

## 📞 Getting Help

- **TypeScript Errors**: Check `tsconfig.json` rules
- **ESLint Errors**: Run `bun run lint --fix`
- **Test Failures**: Check `src/test/` examples
- **Security Issues**: Refer to `SECURITY.md`

---

**Last Updated**: March 2026  
**Version**: 1.0.0-audit-complete
