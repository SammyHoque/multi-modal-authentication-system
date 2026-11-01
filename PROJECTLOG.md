# Project Log

## Week 1 [w/c 29 September 2025]
- Chose project topic: **Graphical Passwords – Preventing Shoulder Surfing**.  
- Read module brief and learning outcomes to understand aims and deliverables.  
- Reviewed previous final-year projects to gauge required technical depth.  
- Began background research on graphical-password methods (colour-based, grid, image-sequence).  
- Arranged first meeting with supervisor (scheduled 3 October).  

---

## Week 2 [w/c 6 October 2025]
- Met supervisor (3 Oct).  
  - Feedback: idea valid but needed greater technical depth.  
  - Recommendation: extend with **hand-gesture** or **face-recognition** login.  
- Researched **MediaPipe Hands** / **Gesture Recognizer** documentation.  
- Created initial HTML + JS prototype detecting hand gestures via webcam.  
- Tested detection reliability and drafted first Gantt-chart timeline.  

---

## Week 3 [w/c 13 October 2025]
- Improved prototype: added “Access Granted / Denied” logic.  
- Recorded short demo video (“hand demo”) for GitLab.  
- Organised GitLab repo (`/src`, `/docs`, `/database`).  
- Added and updated README.md.  
- Uploaded early documentation:  
  - Project Plan (Gantt chart)  
  - Skills Log  
  - **Ethical Documents** (PIS, Consent Form, Recruitment Message, Feedback Questions).  

---

## Week 4 [w/c 20 October 2025] – Design Phase & Ethics Submission
- Created design documents under `/docs/design/`:  
  - **System Overview** (gesture + facial recognition)  
  - **User Flows and Wireframes** (Register & Login)  
  - **Database Structure (MySQL)** and **Backend Architecture (PHP)**  
  - **Security Considerations** and **Liveness Design (blink detection)**    
- **Prepared and submitted Ethical Approval Application**, including PIS, Consent Form, Recruitment Message, and Feedback Questions.  
- Defined access policy: **Access = Gesture MATCH AND Face Liveness PASSED.**  
- Updated root README with links to design and ethics documents.  

---

## Week 5 [w/c 27 October 2025] – Gesture Login Implementation
- Built **gesture registration and login** using **MediaPipe Gesture Recognizer**.  
- Added local gesture storage (`localStorage`) and fuzzy matching logic (≥ 75 % accuracy).  
- Displayed clear feedback (✅ Access Granted / ❌ Access Denied).  
- Uploaded updated `register.html` and `login.html` to GitLab.  
- Recorded and uploaded working gesture login demo.  

---

## Week 6 [w/c 3 November 2025] – UI Wireframes & Face Detection Prototype
- Refactored JavaScript into modular files (`src/js/register.js`, `src/js/login.js`).  
- Designed and finalised **UI Wireframe Plan** for Register and Login pages (based on new layout).  
- Cleaned GitLab structure and added `.gitignore` to ignore system files.  
- Fixed push/sync issues via terminal (`git pull --rebase`, `git push origin main`).  
- Verified gesture login still works after refactor.  
- Began developing **face authentication prototype** using MediaPipe Face Landmarker – currently detects face only (no matching yet).  

---

## Week 7 [w/c 10 November 2025] – Ethics Revision & Interim Report
- Added UI for selecting authentication methods (Gesture / Face).  
- Implemented logic to show/hide Face button on login based on saved preferences (`enabledMethods`).  
- Stored method choices in `localStorage`.  
- Continued integrating MediaPipe Face Landmarker (working on face matching logic).
- Began drafting **Interim Report** (Introduction, Aims, Design, Implementation Progress).   
- **Met supervisor (12 Nov):** application temporarily rejected (needed to be modified).  
- Revised ethical documents and prepared for resubmission.   
- **Reviewed and polished Project Log**, fixing structure and factual inaccuracies. 

---

## Week 8 [w/c 17 November 2025] – Interim Report Completion & Ethics Resubmission
- Completed and submitted the **Interim Report**, including updated sections on design, implementation progress, and evaluation plan.  
- **Resubmitted the revised Ethical Approval Application** following supervisor feedback from Week 7.  
- Improved the **facial password prototype** by trying to implement facial gestures.

---

## Week 9 [w/c 24 November 2025] – Group Meeting & Minor Progress
- Attended the **first group meeting (27 Nov)** to discuss progress and share updates with peers.  
- Made minor improvements to the **facial password** implementation where possible.   

---

## Week 10 [w/c 1 December 2025] – Coursework and Exam Focus
- No significant progress made on the project due to multiple coursework deadlines and exam preparation.  
- Maintained awareness of project requirements and upcoming milestones.  
- Ensured existing project files and documentation remained organised and up to date.  

---

## Week 11 [w/c 8 December 2025] – Continued Academic Commitments
- Limited engagement with the project as focus remained on coursework submissions and examinations.  
- Reviewed the project plan informally to ensure remaining tasks were achievable within the updated timeline.  
- No code or design changes made during this week.  

---

## Week 12 [w/c 15 December 2025] – Planned Break
- Took a planned short break following the completion of exams.  
- No development work carried out on the project during this period.  
- Prepared to resume project work in the following week. 

---

## Week 13 [w/c 22 December 2025] – Facial Password Refactor and Rollback
- Worked on extending the facial password functionality using MediaPipe Face Landmarker.  
- Experimented with different approaches for facial gesture recognition.  
- Changes introduced issues in the existing authentication logic and affected overall system stability.  
- Rolled back and removed incomplete facial password changes to restore a stable codebase.  
- Verified that the gesture-based authentication continued to function correctly after reverting changes.  

---

## Week 14 [w/c 29 December 2025] – Facial Gesture Password Implementation & Voice Password Start
- Implemented a robust facial password mechanism based on facial gestures (e.g. winking, smiling).  
- Improved reliability and consistency of facial gesture detection and matching.  
- Integrated facial authentication with the existing gesture-based login flow.  
- Began initial development of a voice-based password as an additional authentication method.  

---

## Week 15 [w/c 5 January 2026] – Voice Authentication Exploration and Reset
- Began developing a **voice-based password** mechanism as an additional authentication method.  
- Experimented with recognising and matching a user’s voice directly using recorded audio.  
- Found that voice recognition and matching was complex and unreliable in its initial form.  
- Early implementation caused conflicts with existing authentication logic and reduced overall system stability.  
- Decided to **remove and restart the voice authentication implementation** to avoid compounding issues.  
- Used this week to reassess a simpler and more reliable approach for voice-based authentication.  

---

## Week 16 [w/c 12 January 2026] – Functional Voice Password Implementation
- Successfully implemented a **working voice authentication system** using a simplified and robust approach.  
- Designed the voice password flow so users **enter a passkey and record their voice** during registration.  
- Implemented matching logic to verify the recorded voice against the stored reference during login.  
- Integrated the voice password alongside existing gesture and facial authentication methods.  
- Tested the voice authentication flow for consistency and usability.  

---

## Week 17 [w/c 19 January 2026] – Codebase Refactoring and Project Organisation
- Reviewed the overall project structure and identified issues with scalability and maintainability.  
- Refactored the codebase by **splitting authentication logic into separate files and folders**.  
- Organised different authentication methods (gesture, face, voice) into clearer modules.  
- Improved code readability, maintainability, and professionalism of the repository structure.  
- This restructuring made the system easier to extend and manage for future development.  

---

## Week 18 [w/c 26 January 2026] – Dynamic Gesture Password with DTW
- Improved the hand gesture authentication system by implementing **Dynamic Time Warping (DTW)** for gesture comparison.  
- Replaced fixed gesture matching with a more flexible system allowing users to perform **custom gesture sequences**.  
- Enhanced robustness of gesture verification by comparing gesture trajectories rather than relying on predefined labels.  
- Tested the updated system to ensure compatibility with existing face and voice authentication methods.  

---

## Week 19 [w/c 2 February 2026] – Exam Preparation & Interview Preparation
- Limited technical development due to exam revision commitments.  
- Prepared for interview with the **Final Project Principal Marker**, reviewing design decisions and implementation progress.  
- Reflected on system architecture, authentication flow, and security considerations in preparation for discussion.  

---

## Week 20 [w/c 9 February 2026] – Project Interview & Reflection
- Attended interview with the **Principal Marker** to discuss project progress and technical decisions.  
- Received feedback on authentication design, system structure, and future improvements.  
- Began reflecting on feedback and identifying areas for refinement and further development.  
- Considered improvements to robustness, evaluation methodology, and overall system clarity moving forward.  

---

## Week 21 [w/c 16 February 2026] – FaceID Research
- Began researching approaches for implementing **FaceID-style authentication** within the project.  
- Investigated different methods for facial verification using MediaPipe and browser-based computer vision tools.  
- Compared possible approaches to determine whether facial motion authentication should be replaced or extended with FaceID.  
- Considered usability, reliability, and implementation complexity when evaluating potential solutions.  

---

## Week 22 [w/c 23 February 2026] – Supervisor Meeting & Design Decision
- Met with supervisor to review progress and discuss the future direction of facial authentication.  
- Discussed whether to **replace the facial motion password** or introduce **FaceID as an additional authentication method**.  
- Decided to implement **FaceID as a fourth authentication method**, alongside gesture, facial gestures, and voice passwords.  
- Planned next steps for integrating FaceID into the existing authentication framework.  

---

## Week 23 [w/c 2 March 2026] – FaceID Prototype Development (Initial Work)
- Began developing an **initial prototype for FaceID authentication**.  
- Started experimenting with facial detection and recognition approaches using browser-based tools.  
- Focused on setting up the basic structure needed to support FaceID within the existing authentication system.  
- Prototype development is still **in progress and not yet fully functional**.  

---

## Week 24 (w/c 9th March) – Face ID Initial Attempts and Reset

- Began implementing a **Face ID authentication method** as an additional graphical password option.  
- Experimented with different approaches; however, the initial implementation was unsuccessful and introduced instability into the existing codebase.  
- Encountered issues with detection reliability and integration with other authentication methods.  
- Due to these problems, I decided to discard the implementation and restart the Face ID feature from scratch to ensure a cleaner and more stable approach.  

---

## Week 25 (w/c 16th March) – Face ID Challenges and Gesture Improvement

- Continued working on Face ID but faced further issues with accuracy and consistency, leading to another unsuccessful attempt.  
- Decided to **temporarily pause** Face ID development to avoid further delays and focus on improving existing authentication methods.  
- Strengthened the gesture password system, as earlier versions lacked robustness and consistency in recognition.  
- Explored alternative Face ID approaches, including using MediaPipe facial landmarks instead of external APIs.  
- Determined that some APIs would have been easier to implement with a backend system; however, due to the current front-end-only prototype, I proceeded with a MediaPipe-based solution as a **fallback approach**.  

---

## Week 26 (w/c 23rd March) – Functional Face ID and UI Development

- Successfully implemented a working **Face ID prototype** using **MediaPipe facial landmarks**, achieving partial reliability.  
- Integrated Face ID as an additional authentication method alongside gesture, facial motion, and voice.  
- Developed a basic authentication flow, including a page where users can either create an account or log in.  
- Created a dummy dashboard page to simulate successful authentication and improve the overall system flow.  
- Began improving the user interface, focusing on layout, usability, and consistency across pages. 

---

## Week 27 (w/c 30th March) – Backend Development and FaceID Upgrade
- Developed a **backend system using Node.js and Express** to replace reliance on localStorage and support secure authentication.  
- Implemented a **PostgreSQL database** using the `pg` library to manage users and authentication data.  
- Designed database tables using **SQL and JSONB fields** to store flexible authentication templates.  
- Applied security measures by implementing **AES encryption** (including IV, authentication tag, and ciphertext) for storing sensitive authentication data.  
- Added backend protections including **rate limiting, input validation, session handling (partial), and CORS configuration**.  
- Upgraded the FaceID system by integrating a **Python-based API for facial embeddings**, improving accuracy compared to landmark-based detection.  
- Designed the system so that both approaches coexist:  
  - Primary: embedding-based FaceID (Python API)  
  - Fallback: landmark-based FaceID (MediaPipe)  
- Ensured compatibility between the upgraded FaceID system and existing authentication methods (gesture, facial gestures, voice).  

---

## Week 28 (w/c 6th April) – System Polishing, User Testing & Dissertation Start
- Refined and **polished the codebase** to improve readability, structure, and overall stability.  
- Enhanced the **register page UI** by adding clear instructions to guide users through the authentication setup process.  
- Focused on improving usability in preparation for **participant testing**.  
- Updated **ethical approval documents** to reflect the inclusion of additional authentication methods beyond gesture and facial recognition.  
- Began conducting **user testing**, obtaining consent and feedback from approximately **7 participants**.  
- Initiated the **dissertation writing process**, completing the **Abstract** and **Introduction** sections.  