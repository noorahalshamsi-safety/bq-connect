const cfg = require("../maintenance-cd5bd76/source/deploy/managed/config.cjs");
function receipt({ proof, manifest, intent, receipt }) {
  const binding = cfg.sha(cfg.canonical({ dataset: proof.dataset, seal: proof.seal,
    source: manifest.minimal.sourceFingerprint, endpoint: proof.endpointFingerprint }));
  if (!receipt || receipt.state !== "committed" || receipt.dataset !== proof.dataset ||
      receipt.seal !== proof.seal || receipt.minimalSource !== manifest.minimal.sourceFingerprint ||
      receipt.binding !== binding || intent?.binding !== binding ||
      intent.dataset !== proof.dataset || intent.seal !== proof.seal)
    cfg.fail("minimal_independent_receipt_required");
}
function marker({ proof, manifest, marker }) {
  if (!marker || marker.sourceFingerprint !== manifest.minimal.sourceFingerprint ||
      marker.dataset !== proof.dataset || marker.seal !== proof.seal ||
      marker.counts?.employees !== 6311 || marker.counts?.accounts !== 8 ||
      marker.originalKeys?.session !== manifest.keys.session || marker.originalKeys?.backup !== manifest.keys.backup ||
      marker.sourceBucketFingerprint !== manifest.minimal.sourceBucketFingerprint ||
      marker.membership?.accounts !== manifest.minimal.membership?.accounts ||
      marker.membership?.employees !== manifest.minimal.membership?.employees)
    cfg.fail("minimal_sql_adoption_marker_required");
}
module.exports = { receipt, marker };
