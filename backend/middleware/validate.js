/**
 * Lightweight request validation middleware.
 * Usage:
 *   router.post('/', validateBody({ name: { required: true, type: 'string', minLength: 1 } }), handler)
 *
 * Rule fields:
 *   required   boolean  – field must be present and non-empty
 *   type       string   – 'string' | 'number' | 'boolean' | 'array'
 *   minLength  number   – minimum string length
 *   maxLength  number   – maximum string length
 *   min        number   – minimum numeric value
 *   max        number   – maximum numeric value
 *   enum       array    – value must be one of these
 *   integer    boolean  – value must be a safe integer (when type = 'number')
 */

function applyRules(source, rules) {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const val = source?.[field];
    const missing = val === undefined || val === null || val === '';

    if (rule.required && missing) {
      errors.push(`${field} is required`);
      continue;
    }
    if (missing) continue; // optional, not provided — skip further checks

    if (rule.type === 'string' && typeof val !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (rule.type === 'number' && typeof val !== 'number') {
      errors.push(`${field} must be a number`);
    } else if (rule.type === 'boolean' && typeof val !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    } else if (rule.type === 'array' && !Array.isArray(val)) {
      errors.push(`${field} must be an array`);
    }

    if (rule.integer && (!Number.isSafeInteger(val))) {
      errors.push(`${field} must be an integer`);
    }
    if (rule.minLength !== undefined && typeof val === 'string' && val.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} character${rule.minLength !== 1 ? 's' : ''}`);
    }
    if (rule.maxLength !== undefined && typeof val === 'string' && val.length > rule.maxLength) {
      errors.push(`${field} must be at most ${rule.maxLength} characters`);
    }
    if (rule.min !== undefined && typeof val === 'number' && val < rule.min) {
      errors.push(`${field} must be at least ${rule.min}`);
    }
    if (rule.max !== undefined && typeof val === 'number' && val > rule.max) {
      errors.push(`${field} must be at most ${rule.max}`);
    }
    if (rule.enum && !rule.enum.includes(val)) {
      errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    }
  }

  return errors;
}

function validateBody(rules) {
  return (req, res, next) => {
    const errors = applyRules(req.body, rules);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

function validateParams(rules) {
  return (req, res, next) => {
    const errors = applyRules(req.params, rules);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

function validateQuery(rules) {
  return (req, res, next) => {
    const errors = applyRules(req.query, rules);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

module.exports = { validateBody, validateParams, validateQuery };
