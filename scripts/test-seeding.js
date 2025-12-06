// Test script for class seeding endpoint
// Run this after starting the Next.js server

const testSeedClasses = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/teacher_page/class/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        classes: [
          {
            name: "IT Elective 2 - Web/Mobile Frontend Development (LEC)",
            teacherEmail: "simongranil@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41062",
            day: ["Saturday"],
            time: "7:00 AM-9:00 AM",
            room: "GC Main 525",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
          {
            name: "IT Elective 2 - Web/Mobile Frontend Development (LAB)",
            teacherEmail: "simongranil@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41063",
            day: ["Saturday"],
            time: "9:00 AM-12:00 PM",
            room: "GC Main 525",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
          {
            name: "Business Analytics (LEC)",
            teacherEmail: "michaelrivera@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41058",
            day: ["Saturday"],
            time: "1:00 PM-3:00 PM",
            room: "Online",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                    {
            name: "Business Analytics (LAB)",
            teacherEmail: "michaelrivera@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41059",
            day: ["Saturday"],
            time: "4:00 PM-7:00 PM",
            room: "Online",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                              {
            name: "IT Elective 1 - Project Management & Agile Methodologies (LAB)",
            teacherEmail: "jedidiah@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41061",
            day: ["Thursday"],
            time: "1:00 PM-4:00 PM",
            room: "GC Main 409",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                        {
            name: "IT Elective 1 - Project Management & Agile Methodologies (LEC)",
            teacherEmail: "jedidiah@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41060",
            day: ["Wednesday", "Thursday"],
            time: "4:00 PM-5:00 PM",
            room: "GC Main 410",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                  {
            name: "Event Driven Programming (LEC)",
            teacherEmail: "denrisprovido@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41056",
            day: ["Monday", "Tuesday"],
            time: "5:00 PM-6:00 PM",
            room: "GC Main 521",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                            {
            name: "Event Driven Programming (LAB)",
            teacherEmail: "denrisprovido@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41057",
            day: ["Monday", "Tuesday"],
            time: "6:00 PM-7:30 PM",
            room: "GC Main 519",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                      {
            name: "Networking 2 (LEC)",
            teacherEmail: "denisepunzalan@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41054",
            day: ["Monday", "Tuesday"],
            time: "1:00 PM-2:00 PM",
            room: "GC Main 407",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                                {
            name: "Networking 2 (LAB)",
            teacherEmail: "denisepunzalan@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41055",
            day: ["Monday", "Tuesday"],
            time: "7:30 PM-9:00 PM",
            room: "GC Main 510",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                                          {
            name: "IT Research Methods (LEC)",
            teacherEmail: "denisepunzalan@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41064",
            day: ["Wednesday", "Thursday"],
            time: "11:00 AM-12:00 PM",
            room: "GC Main 408",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                                                    {
            name: "IT Research Methods (LAB)",
            teacherEmail: "denisepunzalan@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41065",
            day: ["Wednesday", "Thursday"],
            time: "9:00 AM-10:30 AM",
            room: "GC Main 408",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                                                              {
            name: "Integrative Programming and Technologies (LEC)",
            teacherEmail: "armilyn@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41052",
            day: ["Monday", "Tuesday"],
            time: "9:00 AM-10:00 AM",
            room: "GC Main 525",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
                                                                                                                      {
            name: "Integrative Programming and Technologies (LAB)",
            teacherEmail: "armilyn@gordoncollege.edu.ph", // Replace with actual teacher email
            studentEmails: [
              "202311564@gordoncollege.edu.ph", // Replace with actual student emails
              "202310319@gordoncollege.edu.ph",
              "202311563@gordoncollege.edu.ph"
            ],
            program: ["Bachelor of Science in Information Technology", "BSIT"],
            yearLevel: "3rd Year",
            classcode: "41053",
            day: ["Monday", "Tuesday"],
            time: "7:30 AM-9:00 AM",
            room: "GC Main 518",
            maxStudents: 30,
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true
            }
          },
   
   
   
   
 
        ]
      })
    });

    const result = await response.json();
    console.log('Seeding Result:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Classes seeded successfully!');
    } else {
      console.log('❌ Seeding failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing seeding:', error);
  }
};

console.log('🌱 Testing class seeding...');
console.log('📝 Make sure to:');
console.log('1. Start your Next.js server (npm run dev)');
console.log('2. Update teacher and student emails in this script');
console.log('3. Run: node test-seeding.js');
console.log('');

// Uncomment the line below to run the test //node test-seeding.js
testSeedClasses();