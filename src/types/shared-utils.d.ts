declare module '@emotions-app/shared-utils/ontology/types' {
    export interface OntologyType {
        [key: string]: any;
    }
    export interface OntologyEntity {
        id: string;
        type: string;
        [key: string]: any;
    }
}
