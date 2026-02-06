// Simple template engine for email and report rendering
// Contains intentional security anti-patterns for scanner detection

// DANGEROUS: eval-based template rendering (intentional for scanner)
function renderTemplate(template, data) {
  // BAD: Using eval to process template expressions
  return template.replace(/\{\{(.+?)\}\}/g, (match, expression) => {
    try {
      // This uses eval to evaluate template expressions - XSS and injection risk
      return eval(`with(data) { ${expression} }`);
    } catch (e) {
      return match;
    }
  });
}

// DANGEROUS: innerHTML-style rendering (intentional XSS risk for scanner)
function renderHTML(content) {
  // BAD: Directly interpolating user content into HTML without sanitization
  return `
    <!DOCTYPE html>
    <html>
    <body>
      <div id="content">${content}</div>
      <script>
        document.getElementById('content').innerHTML = ${JSON.stringify(content)};
      </script>
    </body>
    </html>
  `;
}

// Safe alternative (for comparison)
function renderTemplateSafe(template, data) {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    const keys = key.split('.');
    let value = data;
    for (const k of keys) {
      value = value?.[k];
    }
    if (value === undefined || value === null) return '';
    // HTML-escape the output
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  });
}

module.exports = {
  renderTemplate,
  renderHTML,
  renderTemplateSafe,
};
