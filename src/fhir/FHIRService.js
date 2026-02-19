"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FHIRService = void 0;
const fhirclient_1 = __importDefault(require("fhirclient"));
class FHIRService {
    constructor() {
        this.client = null;
    }
    initialize(fhirServerUrl, patientId, accessToken) {
        try {
            if (!fhirServerUrl) {
                throw new Error('FHIR server URL is required');
            }
            console.log(`Initializing FHIR client with server: ${fhirServerUrl}`);
            // Cast to any because TypeScript definitions don't include patientId,
            // but the library supports it.
            this.client = fhirclient_1.default.client({
                serverUrl: fhirServerUrl,
                patientId: patientId
            });
            console.log('✅ FHIR client initialized successfully');
        }
        catch (error) {
            console.error('❌ FHIR client initialization failed:', error);
            this.client = null;
        }
    }
    async getAllergies(patientId) {
        if (!this.client) {
            const errorMsg = 'FHIR client not initialized. Cannot fetch allergies.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        try {
            console.log(`Fetching allergies for patient ${patientId}...`);
            const result = await this.client.request(`AllergyIntolerance?patient=${patientId}`, {
                resolveReferences: ['substance']
            });
            const allergies = [];
            if (result.entry) {
                result.entry.forEach((entry) => {
                    const resource = entry.resource;
                    if (resource?.substance?.coding) {
                        resource.substance.coding.forEach((coding) => {
                            if (coding.display)
                                allergies.push(coding.display.toLowerCase());
                        });
                    }
                });
            }
            console.log(`Found ${allergies.length} allergies for patient ${patientId}`);
            return allergies;
        }
        catch (error) {
            console.error('Error fetching allergies:', error);
            return [];
        }
    }
    async createBurnAssessment(patientId, data) {
        if (!this.client)
            throw new Error('FHIR client not initialized');
        const observation = {
            resourceType: 'Observation',
            status: 'final',
            code: {
                coding: [{
                        system: 'http://snomed.info/sct',
                        code: '225552003',
                        display: 'Assessment of burn'
                    }],
                text: 'Burn triage assessment'
            },
            subject: {
                reference: `Patient/${patientId}`
            },
            effectiveDateTime: new Date().toISOString(),
            component: [
                { code: { text: 'Burn size' }, valueString: data.burnSize },
                { code: { text: 'Burn location' }, valueString: data.burnLocation },
                { code: { text: 'Burn depth' }, valueString: data.burnDepth },
                { code: { text: 'Triage outcome' }, valueString: data.triageResult }
            ]
        };
        try {
            console.log(`Saving burn assessment for patient ${patientId}...`);
            const result = await this.client.create(observation);
            console.log('✅ Burn assessment saved to FHIR');
            return result;
        }
        catch (error) {
            console.error('Error creating FHIR Observation:', error);
            throw error;
        }
    }
}
exports.FHIRService = FHIRService;
