'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
    id: string;
    question: string;
    answer: string;
}

const faqItems: FAQItem[] = [
    {
        id: 'item-1',
        question: 'What does Career Autopilot do?',
        answer:
            'Career Autopilot is an AI-powered career management platform that automates and optimizes your professional growth. It helps you manage your resume, publish content to LinkedIn, deploy portfolio projects, and track career milestones. Our system learns your career goals and continuously suggests opportunities aligned with your trajectory.',
    },
    {
        id: 'item-2',
        question: 'How does the AI work?',
        answer:
            'Our AI uses advanced machine learning to analyze your skills, experience, and career aspirations. It processes patterns from millions of career paths to identify opportunities, suggest content ideas, and recommend skill development. The AI learns from your interactions and feedback to continuously improve personalized recommendations.',
    },
    {
        id: 'item-3',
        question: 'Can Career Autopilot publish content to LinkedIn?',
        answer:
            'Yes! Career Autopilot generates and publishes LinkedIn posts tailored to your industry and expertise. The AI creates engaging content based on your career updates, achievements, and industry trends. You can review and customize any post before publishing, maintaining full control over your professional brand.',
    },
    {
        id: 'item-4',
        question: 'How does resume updating work?',
        answer:
            'Career Autopilot automatically tracks your accomplishments and suggests resume updates in real-time. Simply log your wins and projects, and the AI transforms them into impact-driven bullet points using proven resume frameworks. Your resume stays current without manual effort, and you can export it anytime in multiple formats.',
    },
    {
        id: 'item-5',
        question: 'Can I deploy my portfolio projects?',
        answer:
            'Yes, Career Autopilot integrates with GitHub and supports one-click deployment to popular platforms like Vercel, Netlify, and AWS. We automatically generate project documentation and showcase pages, making your portfolio stand out to recruiters and employers.',
    },
    {
        id: 'item-6',
        question: 'What is your pricing?',
        answer:
            'Career Autopilot offers a flexible subscription model. Our Starter plan is $29/month and includes AI-powered resume updates, LinkedIn content suggestions, and portfolio tracking. Premium plans at $79/month add unlimited project deployments and priority support. We also offer annual billing with 20% savings.',
    },
    {
        id: 'item-7',
        question: 'How do you handle my data and privacy?',
        answer:
            'We take privacy seriously. Career Autopilot is SOC 2 Type II compliant and encrypts all sensitive data in transit and at rest. We never sell or share your data with third parties. You have full control over your information and can request deletion at any time. For detailed information, see our Privacy Policy.',
    },
    {
        id: 'item-8',
        question: 'What is your cancellation policy?',
        answer:
            'You can cancel your subscription anytime without penalties or long-term contracts. Cancellations are effective at the end of your current billing cycle, and you retain access until then. No questions asked—we want you to use Career Autopilot because it delivers value. If you experience issues, our support team is happy to help.',
    },
];

export default function FAQAccordion() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header Section */}
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 sm:py-24">
                <div className="space-y-2">
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Everything you need to know about Career Autopilot
                    </p>
                </div>
            </div>

            {/* FAQ Accordion Section */}
            <section className="mx-auto max-w-3xl px-4 pb-20">
                <Accordion
                    type="single"
                    collapsible
                    className="w-full space-y-3"
                >
                    {faqItems.map((item) => (
                        <AccordionItem
                            key={item.id}
                            value={item.id}
                            className="border border-border rounded-lg px-6 transition-colors hover:bg-card/50"
                        >
                            <AccordionTrigger className="font-semibold hover:text-foreground/80">
                                {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground leading-relaxed">
                                {item.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>
        </div>
    );
}
