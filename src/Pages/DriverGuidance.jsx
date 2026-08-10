import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Stethoscope, Droplet, User, Activity, Search, Truck, HeartPulse, Hospital, ChevronLeft, ChevronRight } from 'lucide-react';

const GUIDANCE_STEPS = [
  {
    id: 1,
    title: '1) Scene Safety Check',
    icon: ShieldCheck,
    color: '#111',
    slides: [
      { subtitle: "1. Assess Traffic Risks", desc: "Always check for high-speed oncoming vehicles before exiting your ambulance. Pause and look both ways.", img: "" },
      { subtitle: "2. Check Fire Hazards", desc: "Look for smoke, spilled fuel, exposed electrical wires, or active flames near the casualty.", img: "" },
      { subtitle: "3. Wear High-Vis Jacket", desc: "Put on reflective high-visibility outerwear to ensure you are clearly seen on the road.", img: "" },
      { subtitle: "4. Wear Safety Gloves", desc: "Put on nitrile medical gloves immediately to protect against bloodborne pathogens.", img: "" },
      { subtitle: "5. Set Warning Triangles", desc: "Place cones or warning triangles at least 50 meters behind the incident to alert incoming traffic.", img: "" },
      { subtitle: "6. Approach Safely", desc: "Move towards the patient methodically while continually scanning for secondary, hidden dangers.", img: "" }
    ]
  },
  {
    id: 2,
    title: '2) Patient Approach & Response',
    icon: UserCheck,
    color: '#111',
    slides: [
      { subtitle: "1. Approach from Front", desc: "Walk into the patient's direct line of sight so they do not twist their potentially injured neck.", img: "" },
      { subtitle: "2. Kneel Beside Patient", desc: "Get down to the patient's chest level safely, maintaining your own balance.", img: "" },
      { subtitle: "3. Gently Tap Shoulders", desc: "Tap both of the patient's collarbones firmly but gently to test for physical responsiveness.", img: "" },
      { subtitle: "4. Ask \"Are you okay?\"", desc: "Speak loudly and clearly into both ears to check if they can formulate a verbal response.", img: "" },
      { subtitle: "5. Check Response", desc: "Look closely for spontaneous eye opening, purposeful movements, or groaning.", img: "" },
      { subtitle: "6. Call for Backup", desc: "If the patient demonstrates zero response, immediately shout for additional medical assistance.", img: "" }
    ]
  },
  {
    id: 3,
    title: '3) ABC Assessment',
    icon: Stethoscope,
    color: '#ffffff',
    slides: [
      { subtitle: "1. Head-Tilt Chin-Lift", desc: "Place one hand on the forehead and two fingers under the bony part of the chin to open the airway.", img: "" },
      { subtitle: "2. Check Clear Airway", desc: "Look deeply inside the mouth for visible physical obstructions like broken teeth, food, or fluid.", img: "" },
      { subtitle: "3. Listen for Breathing", desc: "Put your ear near the patient's mouth to listen for the sound of air escaping.", img: "" },
      { subtitle: "4. Look at Chest Rise", desc: "Watch the patient's chest line closely for 10 seconds to confirm normal lung inflation.", img: "" },
      { subtitle: "5. Check Neck Pulse", desc: "Locate the carotid artery on the side of the trachea and palpate to check pulse for up to 10 seconds.", img: "" },
      { subtitle: "6. Evaluate Skin Color", desc: "Assess if the face or lips are turning pale, blue (cyanosis), or staying pink.", img: "" }
    ]
  },
  {
    id: 4,
    title: '4) Severe Bleeding Control',
    icon: Droplet,
    color: '#ffffff',
    slides: [
      { subtitle: "1. Identify Bleed Source", desc: "Swiftly scan and cut clothing to locate the exact point of the most severe hemorrhage.", img: "" },
      { subtitle: "2. Apply Direct Pressure", desc: "Press down forcefully directly on the bleeding wound utilizing your whole body weight if needed.", img: "" },
      { subtitle: "3. Add Trauma Pad", desc: "Place a highly absorbent sterile trauma dressing over the wound to soak up ongoing bleeding.", img: "" },
      { subtitle: "4. Wrap Heavy Bandage", desc: "Wrap a crepe elastic bandage extremely tightly around the pad to maintain continuous pressure.", img: "" },
      { subtitle: "5. Apply Tourniquet", desc: "If limb bleeding bypasses the bandage, tightly turn a tourniquet 2 inches horizontally above the wound.", img: "" },
      { subtitle: "6. Note Tourniquet Time", desc: "Use a marker to write the exact application time on the tourniquet or the patient's forehead.", img: "" }
    ]
  },
  {
    id: 5,
    title: '5) Spine & Neck Stabilization',
    icon: User,
    color: '#ffffff',
    slides: [
      { subtitle: "1. Hold Head Steady", desc: "Place your hands firmly on both sides of the patient's head to prevent them from turning.", img: "" },
      { subtitle: "2. Maintain Neutral Spine", desc: "Ensure the head remains perfectly aligned with the torso inline without pulling forcefully.", img: "" },
      { subtitle: "3. Apply Cervical Collar", desc: "Have a second responder measure the neck and carefully slide a rigid collar around the throat.", img: "" },
      { subtitle: "4. Check Collar Fit", desc: "Ensure the collar sits securely resting under the chin and definitely doesn't restrict breathing.", img: "" },
      { subtitle: "5. Prepare Backboard", desc: "Slide a specialized rigid plastic spinal board directly alongside the patient on the ground.", img: "" },
      { subtitle: "6. Log Roll Patient", desc: "Coordinate with your team to roll the patient gently onto the backboard on a synchronized count.", img: "" }
    ]
  },
  {
    id: 6,
    title: '6) Basic Life Support (CPR)',
    icon: Activity,
    color: '#ffffff',
    slides: [
      { subtitle: "1. Check Pulse & Breath", desc: "Confirm the patient is unresponsive and absolutely has no pulse before initiating chest compressions.", img: "" },
      { subtitle: "2. Hand Placement", desc: "Interlock both hands and place the heel on the exact lower half of the central breastbone.", img: "" },
      { subtitle: "3. Start Compressions", desc: "Lock your elbows straight and push hard at a constant rhythm of 100-120 per minute.", img: "" },
      { subtitle: "4. Push 2 Inches Deep", desc: "Compress an adult's chest heavily by at least 2 inches downwards, allowing full recoil.", img: "" },
      { subtitle: "5. Give 2 Rescue Breaths", desc: "After 30 continuous compressions, pinch the nose and give 2 gentle breaths (only if trained).", img: "" },
      { subtitle: "6. Attach AED Promptly", desc: "Rip shirts open to apply defibrillator pads to bare chest immediately upon unit arrival.", img: "" }
    ]
  },
  {
    id: 7,
    title: '7) Secondary Injury Assessment',
    icon: Search,
    color: '#111',
    slides: [
      { subtitle: "1. Check Head & Face", desc: "Gently palpate the entire skull and face framework for any soft spots, bleeding, or skull leakage.", img: "" },
      { subtitle: "2. Check Torso Area", desc: "Examine the chest structure and ribs manually for noticeable instability or painful tender spots.", img: "" },
      { subtitle: "3. Check Abdomen", desc: "Gently press the four quadrants of the stomach checking for rigidness, swelling, or internal pooling.", img: "" },
      { subtitle: "4. Check All Limbs", desc: "Run your hands deliberately down the patient's arms and legs to identify masked bone fractures.", img: "" },
      { subtitle: "5. Splint Fractures", desc: "Use a padded rigid splint closely to stabilize deformed bones thereby preventing transit pain.", img: "" },
      { subtitle: "6. Cover Large Burns", desc: "Relieve burn pain and prevent critical infection by immediately covering major burns loosely with dressings.", img: "" }
    ]
  },
  {
    id: 8,
    title: '8) Safe Patient Transfer',
    icon: Truck,
    color: '#111',
    slides: [
      { subtitle: "1. Prepare Stretcher", desc: "Lower the ambulance stretcher apparatus entirely to the ground situated directly beside the patient.", img: "" },
      { subtitle: "2. Position Patient", desc: "Move the packaged injured person slowly onto the mattress center safely using coordinated lifting pulls.", img: "" },
      { subtitle: "3. Secure Chest Strap", desc: "Fasten the upper restraining belts tightly across the patient's chest and shoulder zones.", img: "" },
      { subtitle: "4. Secure Hip/Leg Strap", desc: "Fasten all the secondary lower belts tightly directly descending over the hips and bottom legs.", img: "" },
      { subtitle: "5. Lift Using Legs", desc: "The responding team must lift the heavy stretcher synchronously using leg muscles, keeping backs rigidly straight.", img: "" },
      { subtitle: "6. Load into Ambulance", desc: "Push the horizontally elevated stretcher frame smoothly directly into the vehicle until it firmly locks.", img: "" }
    ]
  },
  {
    id: 9,
    title: '9) En-route Monitoring',
    icon: HeartPulse,
    color: '#111',
    slides: [
      { subtitle: "1. Attach SpO2 Monitor", desc: "Place a digital pulse oximeter clip immediately on their finger or earlobe to digitally track oxygen.", img: "" },
      { subtitle: "2. Check Blood Pressure", desc: "Wrap the pneumatic BP cuff adequately on the bare upper arm and trigger the first baseline reading.", img: "" },
      { subtitle: "3. Administer Oxygen", desc: "Deliver highly supplementary oxygen gas through a tight mask if saturation reads poorly below 94%.", img: "" },
      { subtitle: "4. Check IV Lines", desc: "If a crucial intravenous liquid drip is running, verify the flow rate and observe the insertion site.", img: "" },
      { subtitle: "5. Monitor Vital Signs", desc: "Continuously check down the radial pulse, exact BP, and breathing rate strictly every few minutes.", img: "" },
      { subtitle: "6. Keep Patient Warm", desc: "Cover trauma or critically shocked patients rapidly with a heated thermal blanket preventing fast hypothermia.", img: "" }
    ]
  },
  {
    id: 10,
    title: '10) Hospital Pre-Alert',
    icon: Hospital,
    color: '#ffffff',
    slides: [
      { subtitle: "1. Use Radio/Portal", desc: "Contact the receiving hospital's inner emergency trauma department directly as early as structurally possible.", img: "" },
      { subtitle: "2. Report Injury Mech.", desc: "Tell the doctors exactly how the kinetic injury violently happened (e.g. violent high-speed unbelted car crash).", img: "" },
      { subtitle: "3. Report Vital Signs", desc: "Provide all of the very latest collected heart rate, systolic/diastolic blood pressure, and monitored oxygen level.", img: "" },
      { subtitle: "4. Report Treatments", desc: "List fundamental interventions already vigorously done onboard like constant CPR, tourniquets, or given drugs.", img: "" },
      { subtitle: "5. Confirm ETA", desc: "Give an incredibly accurate timeline of your swift arrival so the trauma surgeons confidently prep the bay.", img: "" },
      { subtitle: "6. Arrive at Emergency", desc: "Smoothly navigate and rapidly back the critical ambulance firmly into the specific hospital bay securely.", img: "" }
    ]
  }
];



const GuidanceCard = ({ step }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % step.slides.length);
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? step.slides.length - 1 : prev - 1));
  };

  const currentSlide = step.slides[currentIndex];

  return (
    <div className="dg-card">
      <div className="dg-carousel">
        <div className="dg-carousel-bars">
          {step.slides.map((_, i) => (
            <div key={i} className={`dg-bar ${i === currentIndex ? 'active' : ''}`} />
          ))}
        </div>

        <button className="dg-arrow left" onClick={prevSlide}>
          <ChevronLeft size={24} />
        </button>
        <button className="dg-arrow right" onClick={nextSlide}>
          <ChevronRight size={24} />
        </button>

        <div className="dg-sketch-wrap">
          {currentSlide.img && !currentSlide.img.includes('placehold.co') ? (
            <img src={currentSlide.img} alt={currentSlide.subtitle} className="dg-slide-image" />
          ) : (
            <>
              <div className="dg-sketch-bg" />
              <step.icon size={90} strokeWidth={1.2} className="dg-sketch-icon" style={{ color: step.color }} />
            </>
          )}
        </div>

        <div className="dg-counter-badge">
          {currentIndex + 1} / {step.slides.length} Photos
        </div>
      </div>

      <div className="dg-card-body">
        {/* Main Title of the Topic */}
        <h3 className="dg-card-title">
          <span style={{ background: step.color }}></span>
          {step.title}
        </h3>

        {/* Dynamic Title for the specific photo */}
        <h4 className="dg-slide-title" style={{ color: step.color }}>
          {currentSlide.subtitle}
        </h4>

        {/* Dynamic Description for the specific photo */}
        <p className="dg-card-desc">{currentSlide.desc}</p>
      </div>
    </div>
  );
};

const PatientCareSection = () => {
  const patientGuides = [
    {
      id: 1,
      title: "First Aid for Clinical Death",
      desc: "Detailed CPR and defibrillation techniques to restart the heart during critical arrests until hospital handover.",
      icon: HeartPulse,
      time: "Requires 100-120 CPM",
      image: "https://content.presentermedia.com/content/clipart/00005000/5442/doctor_listening_to_patients_heart_300_nwm.jpg"
    },
    {
      id: 2,
      title: "Assisting an Unconscious Patient",
      desc: "Properly identifying the recovery position, securing the airway, and ensuring consistent blood flow to the brain.",
      icon: User,
      time: "Immediate Action",
      image: "/guidance/airway_3d_model.png"
    },
    {
      id: 3,
      title: "Spinal Trauma Management",
      desc: "Strict immobilization of the neck and spine using cervical collars and backboards to prevent paralysis.",
      icon: HeartPulse,
      time: "Immediate Stabilization",
      image: "/guidance/test_final.png"
    },
    {
      id: 4,
      title: "Lower Leg Fracture Care",
      desc: "Immobilization protocols for tibial or fibular fractures to prevent nerve damage and minimize shock.",
      icon: Activity,
      time: "Secure & Transport",
      image: "/guidance/cpr_3d_model.png"
    },
    {
      id: 5,
      title: "Femoral Artery Injury Care",
      desc: "Application of high-pressure tourniquets and trauma dressings to rapidly halt severe arterial hemorrhage.",
      icon: Droplet,
      time: "Hemorrhage Control",
      image: "/guidance/test_final.png"
    },
    {
      id: 6,
      title: "Severe Burn Treatment",
      desc: "Cooling partial and full-thickness burns, applying sterile non-adherent dressings to prevent systemic infection.",
      icon: Activity,
      time: "Immediate Cooling",
      image: "/guidance/airway_3d_model.png"
    }
  ];

  return (
    <div className="pc-section">
      <div className="pc-header">
        <h2>Patient Help & Care Guidance</h2>
        <p>Specific life-saving simulation skills designed to treat and secure critical patient injuries before reaching the hospital.</p>
      </div>
      <div className="pc-grid">
        {patientGuides.map(guide => (
          <div key={guide.id} className="pc-card">
            <div className="pc-image-header">
              {guide.image ? (
                <img src={guide.image} alt={guide.title} className="pc-3d-image" />
              ) : (
                <div className="pc-icon-wrap">
                  <div className="pc-icon-bg" />
                  <guide.icon size={36} strokeWidth={1.5} className="pc-icon" />
                </div>
              )}
            </div>
            <div className="pc-content">
              <h3>{guide.title}</h3>
              <p>{guide.desc}</p>
              <div className="pc-badge">{guide.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PatientRoadmap = () => {
  const steps = [
    { id: 1, title: 'Dispatch', time: '00:00', icon: Truck, status: 'completed' },
    { id: 2, title: 'Scene Arrival', time: '+10:00', icon: ShieldCheck, status: 'completed' },
    { id: 3, title: 'Primary Assessment', time: '+12:30', icon: Search, status: 'active' },
    { id: 4, title: 'Stabilization & CPR', time: '+15:00', icon: HeartPulse, status: 'pending' },
    { id: 5, title: 'En-Route ER', time: '+25:00', icon: Activity, status: 'pending' },
    { id: 6, title: 'Hospital Handover', time: '+35:00', icon: Hospital, status: 'pending' },
  ];

  return (
    <div className="roadmap-section">
      <div className="pc-header">
        <h2>Emergency Response Patient Roadmap</h2>
        <p>Standard timeline sequence representing the critical golden hour for patient care from dispatch to hospital handover.</p>
      </div>

      <div className="roadmap-container">
        {steps.map((step, index) => (
          <div key={step.id} className={`rm-step ${step.status}`}>
            <div className="rm-icon-node">
              <step.icon size={24} className="rm-i" />
              {index < steps.length - 1 && <div className="rm-line" />}
            </div>
            <div className="rm-content">
              <h4>{step.title}</h4>
              <span>{step.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DriverGuidance() {
  return (
    <>
      <style>{`
        .dg-root {
          min-height: 100vh;
          background: #ffffff;
          color: #111;
          font-family: Inter, system-ui, sans-serif;
          padding: 84px 20px 80px 84px; 
          margin-left: 64px;
        }

        .dg-header {
          margin-bottom: 30px;
          border-bottom: 1px solid rgba(17,17,17,0.1);
          padding-bottom: 20px;
        }

        .dg-header h1 {
          font-size: 28px;
          margin: 0 0 10px 0;
          font-weight: 800;
          color: #111;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dg-header p {
          font-size: 15px;
          color: rgba(17,17,17,0.7);
          margin: 0;
          max-width: 800px;
          line-height: 1.5;
        }

        .dg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
          gap: 24px;
        }

        .dg-card {
          background: #fff;
          border: 1px solid #111;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .dg-card:hover {
          transform: translateY(-4px);
          border-color: #ffffff;
          box-shadow: 0 12px 30px rgba(255, 255, 255, 0.15);
        }

        .dg-carousel {
          position: relative;
          height: 220px;
          width: 100%;
          background: #ffffff;
          overflow: hidden;
          border-bottom: 1px solid rgba(17,17,17,0.1);
        }

        .dg-carousel-bars {
          position: absolute;
          top: 10px; left: 14px; right: 14px;
          display: flex;
          gap: 4px;
          z-index: 10;
        }

        .dg-bar {
          flex: 1;
          height: 3px;
          background: rgba(17,17,17,0.15);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        .dg-bar.active {
          background: #111;
          box-shadow: 0 0 4px rgba(255,255,255,0.5);
        }

        .dg-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 36px; height: 50px;
          background: rgba(17,17,17,0.05);
          border: none;
          color: #111;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s ease;
        }
        .dg-arrow:hover { background: rgba(17,17,17,0.15); color: #000; }
        .dg-arrow.left { left: 0; border-radius: 0 6px 6px 0; }
        .dg-arrow.right { right: 0; border-radius: 6px 0 0 6px; }

        .dg-sketch-wrap {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #ffffff 0%, #f7f7f3 100%);
        }

        .dg-sketch-bg {
          position: absolute;
          width: 110px;
          height: 110px;
          background: #ffffff;
          border-radius: 50%;
          transform: translate(10px, 10px);
          opacity: 0.85;
          z-index: 1;
        }

        .dg-sketch-icon {
          position: relative;
          z-index: 2;
        }

        .dg-counter-badge {
          position: absolute;
          bottom: 12px; left: 12px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          z-index: 10;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .dg-card-body {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .dg-card-title {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 15px 0;
          color: #111;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-bottom: 2px solid #f4f4f4;
          padding-bottom: 10px;
        }

        .dg-card-title span {
          width: 8px; height: 8px; 
          border-radius: 50%; 
          margin-top: 6px; flex-shrink: 0;
        }

        .dg-slide-title {
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 6px 0;
        }

        .dg-card-desc {
          font-size: 14px;
          color: rgba(17,17,17,0.75);
          line-height: 1.5;
          margin: 0;
          text-align: left;
          height: 65px; /* Fixed height so card doesnt jump sizes */
        }

        .pc-section {
          margin-top: 60px;
          border-top: 1px solid rgba(17,17,17,0.1);
          padding-top: 40px;
        }
        .pc-header {
          margin-bottom: 30px;
        }
        .pc-header h2 {
          font-size: 26px;
          margin: 0 0 8px 0;
          font-weight: 800;
          color: #111;
        }
        .pc-header p {
          font-size: 15px;
          color: rgba(17,17,17,0.7);
          margin: 0;
          max-width: 600px;
          line-height: 1.5;
        }
        .pc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        .pc-card {
          background: #fff;
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .pc-card:hover {
          transform: translateY(-4px);
          border-color: #ffffff;
          box-shadow: 0 10px 24px rgba(255, 255, 255, 0.15);
        }
        .pc-icon-wrap {
          position: relative;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .pc-icon-bg {
          position: absolute;
          width: 44px;
          height: 44px;
          background: #ffffff;
          border-radius: 50%;
          transform: translate(4px, 4px);
          opacity: 0.6;
          z-index: 1;
        }
        .pc-icon {
          position: relative;
          z-index: 2;
          color: #111;
        }
        .pc-content {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        .pc-content h3 {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 10px 0;
          color: #111;
          line-height: 1.3;
        }
        .pc-content p {
          font-size: 13.5px;
          color: rgba(17,17,17,0.7);
          margin: 0 0 16px 0;
          line-height: 1.5;
          flex-grow: 1;
        }
        .dg-slide-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        .pc-badge {
          display: inline-flex;
          background: rgba(17,17,17,0.06);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          color: #111;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          align-self: flex-start;
          margin-top: auto;
        }

        .pc-image-header {
          width: 100%;
          height: 180px;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(17,17,17,0.08);
        }

        .pc-3d-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        .pc-card:hover .pc-3d-image {
          transform: scale(1.05);
        }

        .roadmap-section {
          margin-top: 60px;
          border-top: 1px solid rgba(17,17,17,0.1);
          padding-top: 40px;
        }

        .roadmap-container {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 40px 20px;
          background: #fff;
          border: 1px solid rgba(17,17,17,0.1);
          border-radius: 16px;
          overflow-x: auto;
        }

        .rm-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          min-width: 140px;
          flex: 1;
        }

        .rm-icon-node {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #f4f4f4;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 16px;
          border: 2px solid transparent;
          transition: all 0.3s ease;
          z-index: 2;
        }

        .rm-line {
          position: absolute;
          top: 50%;
          left: 100%;
          width: calc(100% + 84px);
          height: 3px;
          background: #eee;
          transform: translateY(-50%);
          z-index: 1;
        }

        .rm-step.completed .rm-icon-node {
          background: #111;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .rm-step.completed .rm-line {
          background: #111;
        }

        .rm-step.active .rm-icon-node {
          background: #ffffff;
          color: #111;
          border-color: #111;
          box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.15);
        }
        .rm-step.active .rm-line {
          background: linear-gradient(90deg, #111 50%, #eee 50%);
        }

        .rm-step.pending .rm-icon-node {
          background: #fff;
          border: 2px dashed #ccc;
          color: #999;
        }

        .rm-content h4 {
          font-size: 14px;
          font-weight: 800;
          color: #111;
          margin: 0 0 4px 0;
        }

        .rm-content span {
          font-size: 12px;
          color: #666;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .dg-root { margin-left: 0; padding: 84px 16px 80px 16px; }
          .dg-arrow { width: 30px; height: 40px; }
          .dg-card-desc { height: auto; min-height: 65px; }
          .roadmap-container { flex-direction: column; align-items: flex-start; gap: 30px; }
          .rm-line { top: 100%; left: 50%; width: 3px; height: 30px; transform: translateX(-50%); }
          .rm-step { width: 100%; flex-direction: row; text-align: left; gap: 20px; }
          .rm-icon-node { margin-bottom: 0; }
        }
      `}</style>

      <div className="dg-root">
        <div className="dg-header">
          <h1><ShieldCheck size={32} color="#ffffff" /> Ambulance Team Guidance</h1>
          <p>
            Standard First Aid and Response Protocols. Swipe or click next to view situation-specific guides for every emergency step.
          </p>
        </div>

        <div className="dg-grid">
          {GUIDANCE_STEPS.map((step) => (
            <GuidanceCard key={step.id} step={step} />
          ))}
        </div>

        <PatientCareSection />
        <PatientRoadmap />
      </div>
    </>
  );
}
