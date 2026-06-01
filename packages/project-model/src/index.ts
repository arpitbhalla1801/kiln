export const name = '@kiln/project-model';

import { readFile } from "fs/promises";

export type ManifestObject = Record<string,unknown>

export type KilnManifest = {
    name: string,
    dependencies: string[],
    transforms : ManifestObject[]
    hooks : ManifestObject[]
    validations : ManifestObject[]
    ownershipDeclarations: ManifestObject[]
}

function isObject(value:unknown):value is ManifestObject{
    return value !== null && typeof value == 'object' && !Array.isArray(value)
}

function assertString(value:unknown,fieldname:string):asserts value is string{
    if(typeof(value) !== 'string'){
        throw new Error(`${fieldname} must be a string`)
    }
}

function assertStringArray(value:unknown,fieldname:string):asserts value is string[]{
    if(!Array.isArray(value)){
        throw new Error(`${fieldname} must be an array`)
    }

    for(const item of value){
        if(typeof(item) !== 'string'){
            throw new Error(`${fieldname} must contain only strings`)
        }
    }
}

function assertObjectArray(value:unknown,fieldname:string):asserts value is ManifestObject[]{
    if(!Array.isArray(value)){
        throw new Error(`${fieldname} must be an array`)
    }

    for(const item of value){
        if(!isObject(item)){
            throw new Error(`${fieldname} must contain only objects`)
        }
    }
}

export function parseManifest(raw:unknown):KilnManifest{
    if(!isObject(raw)){
        throw new Error(`Manifest must be an object`)
    }

    assertString(raw.name,'name')
    assertStringArray(raw.dependencies,'dependencies')
    assertObjectArray(raw.transforms,'transforms')
    assertObjectArray(raw.hooks,'hooks')
    assertObjectArray(raw.validations,'validations')
    assertObjectArray(raw.ownershipDeclarations,'ownershipDeclarations')

    return {
        name:raw.name,
        dependencies:raw.dependencies,
        transforms:raw.transforms,
        hooks:raw.hooks,
        validations:raw.validations,
        ownershipDeclarations:raw.ownershipDeclarations
    }
}

export async function loadManifest(manifestPath:string):Promise<KilnManifest>{
    const rawText = await readFile(manifestPath,'utf-8')
    const parsedJson = JSON.parse(rawText)
    return parseManifest(parsedJson)
}