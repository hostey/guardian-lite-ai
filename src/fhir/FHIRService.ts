import FHIR from 'fhirclient';
import  Client  from 'fhirclient/lib/Client';

export interface BurnAssessmentData {
  burnSize: 'large' | 'small' | 'unknown';
  burnLocation: 'dangerous' | 'safe' | 'unknown';
  burnDepth: 'deep' | 'superficial' | 'unknown';
  triageResult: string;
}

export class FHIRService {
  private client: Client | null = null;

  initialize(fhirServerUrl: string, patientId?: string, accessToken?: string) {
    try {
      if (!fhirServerUrl) {
        throw new Error('FHIR server URL is required');
      }
      console.log(`Initializing FHIR client with server: ${fhirServerUrl}`);
      // Cast to any because TypeScript definitions don't include patientId,
      // but the library supports it.
      this.client = FHIR.client({
        serverUrl: fhirServerUrl,
        patientId: patientId
      } as any);
      console.log('✅ FHIR client initialized successfully');
    } catch (error) {
      console.error('❌ FHIR client initialization failed:', error);
      this.client = null;
    }
  }

  async getAllergies(patientId: string): Promise<string[]> {
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

      const allergies: string[] = [];
      if (result.entry) {
        result.entry.forEach((entry: any) => {
          const resource = entry.resource;
          if (resource?.substance?.coding) {
            resource.substance.coding.forEach((coding: any) => {
              if (coding.display) allergies.push(coding.display.toLowerCase());
            });
          }
        });
      }
      console.log(`Found ${allergies.length} allergies for patient ${patientId}`);
      return allergies;
    } catch (error) {
      console.error('Error fetching allergies:', error);
      return [];
    }
  }

  async createBurnAssessment(patientId: string, data: BurnAssessmentData): Promise<any> {
    if (!this.client) throw new Error('FHIR client not initialized');

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
    } catch (error) {
      console.error('Error creating FHIR Observation:', error);
      throw error;
    }
  }
}