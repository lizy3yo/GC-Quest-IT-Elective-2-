import React from "react";
import Link from "next/link";

export default function CreateChoicePage() {
    return (
        <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
            <h1>Create assessment</h1>
            <p>Choose a style for this assessment:</p>

            <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
                <div style={{
                    flex: 1,
                    border: "1px solid #e6e6e6",
                    borderRadius: 8,
                    padding: 16,
                }}>
                    <h2>Quizizz-style</h2>
                    <p>Interactive, one-question-at-a-time flow with game-like feedback.</p>
                    <Link
                        href="/teacher_page/assessment/create/interactive"
                        style={{
                            display: "inline-block",
                            marginTop: 12,
                            padding: "8px 12px",
                            background: "#0b69ff",
                            color: "white",
                            borderRadius: 6,
                            textDecoration: "none"
                        }}
                    >
                        Start Quiz Flow
                    </Link>
                </div>

                <div style={{
                    flex: 1,
                    border: "1px solid #e6e6e6",
                    borderRadius: 8,
                    padding: 16,
                }}>
                    <h2>Form-style</h2>
                    <p>Classic form layout (like Google Forms) for sections and mixed question types.</p>
                    <Link
                        href="/teacher_page/assessment/create/form"
                        style={{
                            display: "inline-block",
                            marginTop: 12,
                            padding: "8px 12px",
                            background: "#34c759",
                            color: "white",
                            borderRadius: 6,
                            textDecoration: "none"
                        }}
                    >
                        Start Form Flow
                    </Link>
                </div>
            </div>
        </main>
    );
}