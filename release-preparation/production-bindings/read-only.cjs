// Capabilities exposed to diagnostics contain reads only; never hand helpers
// the Pool, raw PostgreSQL client, or writable App Storage SDK client.
function sql(client) {
  return Object.freeze({
    query(text, params) {
      if (typeof text !== "string" || !/^\s*SELECT\b/i.test(text) || text.includes(";"))
        throw Object.assign(Error("read-only query required"), { code: "preflight_query_refused" });
      return client.query(text, params);
    }
  });
}
function source(client) {
  return Object.freeze({
    exists: name => client.exists(name),
    downloadAsText: name => client.downloadAsText(name)
  });
}
function target(client) {
  return Object.freeze({ list: options => client.list(options) });
}
module.exports = { sql, source, target };
