"use client";

interface GreetingProps {
  firstName: string | null;
}

export default function Greeting({ firstName }: GreetingProps) {
  return (
    <header className="greet-block" aria-label="Welcome">
      <h1 className="greet-title">{`Welcome Back, ${firstName || "Student"}!`}</h1>
      <p className="greet-sub">
        Ready to continue your learning journey?
      </p>
    </header>
  );
}
