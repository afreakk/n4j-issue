# Example of neo4j/graphql issue

Run tests by executing following commands:
```
yarn install
./test.sh watch-test
```
Test should now fail with:
```
...snipped...
-               "id": Any<String>,
+           "extensions": Object {
+             "code": "INTERNAL_SERVER_ERROR",
+             "stacktrace": Array [
+               "Neo4jGraphQLForbiddenError: Forbidden",
...snipped...
```
Now if you change the following type in schema.graphql:
```
type VehicleCard
    @authorization(
        validate: [{ where: { node: { tenant: { admins: { userId: "$jwt.id" } } } } }]
    ) {
    id: ID! @id
    garages: [Garage!]! @relationship(type: "VALID_GARAGES", direction: OUT)
    tenant: Tenant! @relationship(type: "VEHICLECARD_OWNER", direction: OUT) # <---  this line
}
```

By move the pointed to line up so the type will look like this:
```
type VehicleCard
    @authorization(
        validate: [{ where: { node: { tenant: { admins: { userId: "$jwt.id" } } } } }]
    ) {
    id: ID! @id
    tenant: Tenant! @relationship(type: "VEHICLECARD_OWNER", direction: OUT) # <---  this line
    garages: [Garage!]! @relationship(type: "VALID_GARAGES", direction: OUT)
}
```
Tests will now pass...
(you can force save index.test.js to force rerun of tests)

