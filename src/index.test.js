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
const laterResolvedValues = (type) => {
    const values = {};
    const get = (key) => {
        expect(values[key]).toBeTypeOf(type);
        return values[key];
    };
    const set = (key, value) => {
        values[key] = value;
    };
    return { set, get };
};

describe('testing graphql', async () => {
    await driver.session().run(` match (n) detach delete n`);
    const myUserId = Math.random().toString(36).slice(2, 7);
    const usernameCallback = (_parent, _args, context) => {
        const userId = context.jwt?.id;

        if (typeof userId === 'string') {
            return userId;
        }
        return undefined;
    };

    const features = {
        populatedBy: {
            callbacks: {
                getUserIDFromContext: usernameCallback,
            },
        },
    };
    const neo4jGraphql = new Neo4jGraphQL({
        features,
        typeDefs: readFileSync(
            join(__dirname, 'schema.graphql'),
            'utf8'
        ).toString(),
        driver,
    });
    const apolloServer = new ApolloServer({
        schema: await neo4jGraphql.getSchema(),
        introspection: true,
    });
    const l = laterResolvedValues('string');
    it('create tenant', async () => {
        const ADD_TENANT = gql`
            mutation addTenant($input: [TenantCreateInput!]!) {
                createTenants(input: $input) {
                    tenants {
                        id
                        admins {
                            userId
                        }
                    }
                }
            }
        `;
        const tenantVariables = {
            input: {
                admins: {
                    create: {
                        node: { userId: myUserId },
                    },
                },
            },
        };
        const r = await apolloServer.executeOperation(
            { query: ADD_TENANT, variables: tenantVariables },
            { contextValue: { jwt: { id: myUserId, roles: ['overlord'] } } }
        );
        expect(r).toMatchObject({
            body: {
                singleResult: {
                    data: {
                        createTenants: {
                            tenants: [
                                {
                                    id: expect.any(String),
                                    admins: [{ userId: myUserId }],
                                },
                            ],
                        },
                    },
                },
            },
        });
        l.set('tenantId', r.body.singleResult.data.createTenants.tenants[0].id);
        l.set(
            'userId',
            r.body.singleResult.data.createTenants.tenants[0].admins[0].userId
        );
    });
    it('create garage', async () => {
        const ADD_GARAGES = gql`
            mutation addGarages($input: [GarageCreateInput!]!) {
                createGarages(input: $input) {
                    garages {
                        id
                    }
                }
            }
        `;
        const garageInput = (tenantId) => ({
            tenant: {
                connect: {
                    where: {
                        node: {
                            id: tenantId,
                        },
                    },
                },
            },
        });
        const r = await apolloServer.executeOperation(
            {
                query: ADD_GARAGES,
                variables: { input: garageInput(l.get('tenantId')) },
            },
            { contextValue: { jwt: { id: myUserId, roles: ['overlord'] } } }
        );
        expect(r).toMatchObject({
            body: {
                singleResult: {
                    data: {
                        createGarages: {
                            garages: [{ id: expect.any(String) }],
                        },
                    },
                },
            },
        });
        l.set('garageId', r.body.singleResult.data.createGarages.garages[0].id);
    });
    it('create vehiclecard', async () => {
        const ADD_VEHICLE_CARD = gql`
            mutation addVehicleCard($input: [VehicleCardCreateInput!]!) {
                createVehicleCards(input: $input) {
                    vehicleCards {
                        id
                    }
                }
            }
        `;
        const vehiclecardInput = ({ garageId, tenantId }) => ({
            tenant: {
                connect: {
                    where: {
                        node: {
                            id: tenantId,
                        },
                    },
                },
            },
            garages: {
                connect: {
                    where: {
                        node: {
                            id: garageId,
                        },
                    },
                },
            },
        });
        const r = await apolloServer.executeOperation(
            {
                query: ADD_VEHICLE_CARD,
                variables: {
                    input: vehiclecardInput({
                        garageId: l.get('garageId'),
                        tenantId: l.get('tenantId'),
                    }),
                },
            },
            { contextValue: { jwt: { id: myUserId, roles: ['overlord'] } } }
        );
        expect(r).toMatchObject({
            body: {
                singleResult: {
                    data: {
                        createVehicleCards: {
                            vehicleCards: [{ id: expect.any(String) }],
                        },
                    },
                },
            },
        });
    });
});
