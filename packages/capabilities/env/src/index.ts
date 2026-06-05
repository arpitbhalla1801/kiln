export const name = '@kiln/env-capability';
import type { KilnManifest } from '@kiln/project-model';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
export const envManifest: KilnManifest = {
    name,
    dependencies: [],
    transforms: [],
    hooks: [],
    validations: [
        {
            name: 'validate-env-vars'
        }
    ],
    ownershipDeclarations: [
        {
            path: '.env',
            owner: name
        },
        {
            path: '.env.example',
            owner: name
        }
    ]
}

export type EnvVarDefinition = {
    key: string,
    value?: string,
    exampleValue?: string
}

export type EnvValidationResult = {
    valid: boolean,
    missing: string[]
}

export type envValidationResult = EnvValidationResult

function parseEnvKeys(contents: string): Set<string> {
    const keys = new Set<string>()
    for (const line of contents.split('\n')) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
        if (match) {
            keys.add(match[1])
        }
    }
    return keys
}
async function readEnvFile(filePath: string): Promise<string> {
    if (!existsSync(filePath)) {
        return ''
    }
    return readFile(filePath, 'utf-8')
}


async function upsertEnvFile(
    filePath: string,
    variables: EnvVarDefinition[],
    getValue: (variable: EnvVarDefinition) => string
): Promise<void> {
    const current = await readEnvFile(filePath)
    const parsedKeys = parseEnvKeys(current)
    const linesToAdd: string[] = []
    for (const variable of variables) {
        if (!parsedKeys.has(variable.key)) {
            linesToAdd.push(`${variable.key}=${getValue(variable)}`)
            parsedKeys.add(variable.key)
        }
    }
    if (linesToAdd.length === 0) {
        return;
    }
    const seperator = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
    const nextContents = `${current}${seperator}${linesToAdd.join('\n')}\n`
    await writeFile(filePath, nextContents, 'utf-8')
}


export async function createEnvExample(
    projectPath: string,
    variables: EnvVarDefinition[],
): Promise<void> {
    await upsertEnvFile(join(projectPath, '.env.example'), variables, (variable) => variable.exampleValue ?? '')
}


export async function injectEnvVars(
    projectPath: string,
    variables: EnvVarDefinition[]
): Promise<void> {
    await upsertEnvFile(join(projectPath, '.env'), variables, (variable) => variable.value ?? variable.exampleValue ?? '')
}


export async function validateEnvVars(
    projectPath: string
): Promise<EnvValidationResult> {
    const envContent = await readEnvFile(join(projectPath, '.env'))
    const exampleContent = await readEnvFile(join(projectPath, '.env.example'))
    const envKeys = parseEnvKeys(envContent)
    const exampleKeys = parseEnvKeys(exampleContent)
    const missing = [...exampleKeys].filter((key) => !envKeys.has(key))

    return {
        valid: missing.length === 0,
        missing
    }
}

export function getOwnershipDeclaration(): KilnManifest['ownershipDeclarations'] {
    return envManifest.ownershipDeclarations
}
