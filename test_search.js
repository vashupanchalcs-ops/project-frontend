const https = require('https');
const queries = ['ambulance-medic', 'cpr-first-aid', 'patient-care', 'bleeding-wound', 'bone-fracture', 'hospital-stretcher', 'heart-monitor', 'medical-equipment', 'doctor-clipboard', 'patient-transfer'];
queries.forEach(q => console.log(`https://source.unsplash.com/600x300/?medical-illustration,${q}`));
