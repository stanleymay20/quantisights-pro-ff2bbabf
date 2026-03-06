# Security Best Practices & Audit Guide

## 🔒 Critical Security Checklist

### Environment Variables
- [ ] **DO NOT commit `.env` files to git**
  ```bash
  # Verify .env is in .gitignore
  grep "^\.env$" .gitignore
  ```
- [ ] Use different keys for dev/staging/production
- [ ] Rotate Supabase keys immediately (keys were exposed in commit history)
  ```bash
  # Steps to rotate:
  1. Go to Supabase dashboard → Project Settings → API Keys
  2. Create new anon key
  3. Update .env file locally only
  4. Update GitHub Actions secrets
  5. Delete old keys
  ```
- [ ] Store sensitive config in GitHub Actions Secrets, never in code

### Code Security

#### Input Validation
```typescript
// ✅ GOOD: Validate before use
import { validateRequired } from '@/lib/error-handler';

function processUserInput(data: unknown) {
  const typed = data as any;
  validateRequired(typed, ['name', 'email']);
  // Now safe to use typed.name and typed.email
}

// ❌ BAD: Direct use of user input
const userText = req.body.text;
db.insert({ content: userText }); // Vulnerable to injection
```

#### API Security
```typescript
// ✅ GOOD: Error handling without exposing internals
import { handleAsync, parseAPIError } from '@/lib/error-handler';

const [data, error] = await handleAsync(
  fetchUserData(userId),
  { operation: 'fetchUserData', metadata: { userId } }
);

if (error) {
  const { message } = parseAPIError(error);
  return toast({ title: 'Error', description: message }); // Safe message
}

// ❌ BAD: Exposing internal errors
try {
  const data = await fetchUserData(userId);
} catch (e) {
  toast({ title: 'Error', description: e.message }); // May leak internals
}
```

#### XSS Prevention
```typescript
// ✅ GOOD: Use React's built-in escaping
function UserProfile({ name }: { name: string }) {
  return <div>{name}</div>; // Automatically escaped
}

// ✅ GOOD: DOMPurify for HTML content
import DOMPurify from 'dompurify';
const safeHtml = DOMPurify.sanitize(userHtml);
return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;

// ❌ BAD: Direct injection
const userInput = '<img src=x onerror="alert(1)">';
return <div dangerouslySetInnerHTML={{ __html: userInput }} />; // XSS!
```

#### Logging
```typescript
// ✅ GOOD: Use structured logger
import { logger } from '@/lib/logger';

logger.error('Payment failed', error, {
  operation: 'processPayment',
  customerId: customer.id, // Safe: internal ID
});

// ❌ BAD: Logging sensitive data
console.error('User password reset:', { email, password });  // Leaks password!
```

### Database Security

#### Row-Level Security (RLS)
```sql
-- ✅ GOOD: All queries filtered by org
SELECT * FROM decisions 
WHERE organization_id = auth.uid()::text;

-- ✅ GOOD: RLS policy enforced
CREATE POLICY "Users can only see their org's data"
  ON decisions
  USING (organization_id = (auth.jwt() ->> 'org_id'));

-- ❌ BAD: No organization filter
SELECT * FROM decisions;  -- Cross-org data leak!
```

#### Query Safety
```typescript
// ✅ GOOD: Parameterized queries
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);  // Parameterized

// ❌ BAD: String interpolation
const query = `SELECT * FROM users WHERE id = '${userId}'`; // SQL injection!
```

### Secrets & API Keys

#### Never commit:
- Supabase keys
- API tokens
- Stripe keys
- OAuth credentials
- Database passwords
- Private encryption keys

#### Storage options:
| Location | Use Case |
|----------|----------|
| `.env.local` (gitignored) | Development |
| GitHub Secrets | CI/CD, GitHub Actions |
| Environment variables | Production (set by deployment platform) |
| HashiCorp Vault | Enterprise |

### Audit Trail

All mutations **MUST** be logged:
```typescript
// Log all changes to audit table
await supabase.from('audit_log').insert({
  actor_id: user.id,
  action: 'update_decision',
  resource_type: 'decision_ledger',
  resource_id: decision.id,
  changes: { old_status: 'pending', new_status: 'approved' },
  ip_address: request.headers['x-forwarded-for'],
  timestamp: new Date().toISOString(),
});
```

## 📋 Regular Audit Tasks

### Weekly
- [ ] Review GitHub audit log for unauthorized access
- [ ] Check for committed secrets using `git log --all -G "VITE_SUPABASE"`
- [ ] Monitor dependencies for new vulnerabilities (`bun audit`)

### Monthly
- [ ] Rotate API keys
- [ ] Review access logs
- [ ] Audit RLS policies for policy drift
- [ ] Check SSL/TLS certificate expiration

### Quarterly
- [ ] Full security assessment
- [ ] Dependency update review
- [ ] Penetration testing (if possible)

## 🛠️ Tools & Commands

### Scan for exposed secrets
```bash
# Install git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# Scan repository
git secrets --scan

# Configure patterns to detect
git secrets --register-aws
git secrets --add 'SUPABASE_KEY'
```

### Check TypeScript strict mode
```bash
bun run tsc --noEmit
```

### Run ESLint with security plugin
```bash
bun run lint
```

### Audit dependencies
```bash
bun audit --all
npm audit
```

## 🔐 Incident Response

If secrets are leaked:

1. **Immediately rotate** all exposed keys
2. **Check audit logs** for unauthorized access
3. **Notify users** if personal data was accessed
4. **Purge git history** of the secret:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' -- --all
   git push --force --all
   ```
5. **Document** the incident for compliance

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
