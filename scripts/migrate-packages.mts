import { adminConnection, dbName, packageSchemaSql } from "./_env.mjs";

const c = await adminConnection();
await c.query(packageSchemaSql());
await c.end();
console.log(`✓ tour package tables ready in ${dbName}`);
