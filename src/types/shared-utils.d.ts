declare module '@a0n/shared-utils/ontology/types' {
    export interface OntologyType {
        [key: string]: any;
    }
    export interface OntologyEntity {
        id: string;
        type: string;
        [key: string]: any;
    }
}
