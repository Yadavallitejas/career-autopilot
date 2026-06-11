import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#10b981", // emerald-500
            colorBackground: "#09090b", // zinc-950
            colorText: "#f4f4f5", // zinc-100
            colorTextSecondary: "#a1a1aa", // zinc-400
            colorInputBackground: "#18181b", // zinc-900
            colorInputText: "#f4f4f5",
            borderRadius: "0.75rem",
          },
          elements: {
            card: "shadow-2xl border border-zinc-800",
            headerTitle: "text-zinc-100",
            headerSubtitle: "text-zinc-400",
            socialButtonsBlockButton:
              "border-zinc-700 hover:border-zinc-500 bg-zinc-900 text-zinc-100",
            formButtonPrimary:
              "bg-emerald-600 hover:bg-emerald-500 text-white",
            footerActionLink: "text-emerald-400 hover:text-emerald-300",
            dividerLine: "bg-zinc-800",
            dividerText: "text-zinc-500",
            formFieldInput:
              "bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-emerald-500",
            formFieldLabel: "text-zinc-300",
          },
        }}
      />
    </div>
  );
}
