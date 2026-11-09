export interface CatalogIdentity { id: string; name: string }

export function compareCatalogIdentities(
  application: readonly CatalogIdentity[],
  database: readonly CatalogIdentity[],
) {
  const app = new Map(application.map((item) => [item.id, item.name]));
  const db = new Map(database.map((item) => [item.id, item.name]));
  return {
    applicationCount: application.length,
    databaseCount: database.length,
    missingInDatabase: [...app.keys()].filter((id) => !db.has(id)).length,
    extraInDatabase: [...db.keys()].filter((id) => !app.has(id)).length,
    differingNames: [...app].filter(([id, name]) => db.has(id) && db.get(id) !== name).length,
    duplicateApplicationIds: application.length - app.size,
    duplicateDatabaseIds: database.length - db.size,
  };
}
