"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const Guardian_1 = require("./orchestrator/Guardian");
const FHIRService_1 = require("./fhir/FHIRService");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
const fhirEnabled = !!process.env.FHIR_SERVER_URL;
console.log(`FHIR enabled: ${fhirEnabled}`);
if (fhirEnabled) {
    console.log(`FHIR server URL: ${process.env.FHIR_SERVER_URL}`);
}
const guardian = new Guardian_1.Guardian(fhirEnabled, process.env.FHIR_SERVER_URL);
// FHIR allergy endpoint with validation
app.get('/api/fhir/patient/:pid/allergies', async (req, res) => {
    const { pid } = req.params;
    if (!pid)
        return res.status(400).json({ error: 'Patient ID required' });
    if (!process.env.FHIR_SERVER_URL) {
        console.error('FHIR_SERVER_URL environment variable not set');
        return res.status(500).json({ error: 'FHIR server not configured' });
    }
    try {
        const fhir = new FHIRService_1.FHIRService();
        fhir.initialize(process.env.FHIR_SERVER_URL);
        const allergies = await fhir.getAllergies(pid);
        res.json({ allergies });
    }
    catch (error) {
        console.error('Failed to fetch allergies:', error);
        res.status(500).json({ error: 'Could not retrieve allergies' });
    }
});
app.post('/api/chat', async (req, res) => {
    const { sessionId, input, patientId } = req.body;
    if (!sessionId || !input) {
        return res.status(400).json({ error: 'Missing sessionId or input' });
    }
    try {
        const result = await guardian.process(sessionId, input, patientId);
        res.json(result);
    }
    catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.listen(port, () => {
    console.log(`Guardian Lite listening on port ${port}`);
    if (fhirEnabled)
        console.log(`FHIR enabled with server: ${process.env.FHIR_SERVER_URL}`);
});
