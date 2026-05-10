const { lastNameInRange } = require('../utils/session-assignment');

describe('lastNameInRange', () => {
  it('preserves single-letter A-Z range behavior for full last names', () => {
    expect(lastNameInRange('Zimmerman', 'A', 'Z')).toBe(true);
    expect(lastNameInRange('Adams', 'A', 'Z')).toBe(true);
  });

  it('supports generated full-name boundaries', () => {
    expect(lastNameInRange('Baker', 'Adams', 'Clark')).toBe(true);
    expect(lastNameInRange('Dunn', 'Adams', 'Clark')).toBe(false);
  });
});
