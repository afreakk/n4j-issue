import { readFileSync } from 'fs';
import { ApolloServer } from '@apollo/server';
import { join } from 'path';
import { Neo4jGraphQL } from '@neo4j/graphql';
import { it, describe, expect, test } from 'vitest';
import { gql } from '@apollo/client/core';
import neo4j from 'neo4j-driver';
const driver = neo4j.driver(
    process.env.NEO4J_DATABASE_HOST,
    neo4j.auth.basic(
        process.env.NEO4J_DATABASE_USERNAME,
        process.env.NEO4J_DATABASE_PASSWORD
    )
);

describe('testing graphql', async () => {
    await driver.session().run(` match (n) detach delete n`);
    const myUserId = Math.random().toString(36).slice(2, 7);
    const neo4jGraphql = new Neo4jGraphQL({
        typeDefs: readFileSync(
            join(__dirname, 'schema.graphql'),
            'utf8'
        ).toString(),
        driver,
        features: {
            populatedBy: {
                callbacks: {
                    getUserIDFromContext: () => 'hi',
                },
            },
        },
    });
    const apolloServer = new ApolloServer({
        schema: await neo4jGraphql.getSchema(),
        introspection: true,
    });
    it('create tenant', async () => {
        const r = await apolloServer.executeOperation(
            {
                query: gql`
                    mutation addTenant($input: [TenantCreateInput!]!) {
                        createTenants(input: $input) {
                            tenants {
                                id
                                admins {
                                    userId
                                }
                                cars {
                                    id
                                    name
                                }
                            }
                        }
                    }
                `,
                variables: {
                    input: {
                        admins: {
                            create: [{ node: { userId: myUserId } }],
                        },
                        cars: { create: [{ node: { name: 'bmw' } }] },
                    },
                },
            },
            {
                contextValue: {
                    jwt: { id: myUserId },
                },
            }
        );
        expect(r).toMatchObject({
            body: {
                singleResult: {
                    errors: undefined,
                    data: {
                        createTenants: {
                            tenants: [
                                {
                                    id: expect.any(String),
                                    admins: [{ userId: myUserId }],
                                    cars: [{ name: 'bmw' }],
                                },
                            ],
                        },
                    },
                },
            },
        });
        const o = await apolloServer.executeOperation(
            {
                query: gql`
                    mutation deleteCar($input: DeleteCarInput!) {
                        deleteCar(input: $input) {
                            reason
                        }
                    }
                `,
                variables: {
                    input: {
                        carId: r.body.singleResult.data.createTenants.tenants[0]
                            .cars[0].id,
                        reason: 'ugly car',
                    },
                },
            },
            {
                contextValue: {
                    jwt: { id: myUserId },
                },
            }
        );
        expect(o).toMatchObject({
            body: {
                singleResult: {
                    errors: undefined,
                },
            },
        });
    });
});
