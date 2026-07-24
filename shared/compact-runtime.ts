// Re-exports the compact-runtime pieces the offline demo simulator needs.
//
// This file must live outside frontend/ on purpose: frontend/ and the repo
// root each have their own separate `npm install` of
// `@midnight-ntwrk/compact-runtime` (same version, distinct physical copies).
// `managed/contract/index.js` resolves its `@midnight-ntwrk/compact-runtime`
// import relative to *its own* location (repo root), so every ContractState /
// ChargedState object it builds is an instance of the root copy's classes.
// If frontend/src imported `@midnight-ntwrk/compact-runtime` directly, it
// would get the frontend copy instead, and compact-runtime's internal type
// checks (e.g. `coerceToChargedState`) reject objects built by the other
// copy's classes even though the version matches. Routing through this file
// — which resolves against the root node_modules, same as managed/ — keeps
// everything on one instance.
export {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
