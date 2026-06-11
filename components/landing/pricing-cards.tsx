'use client';

import { Check } from 'lucide-react';

const PricingCards = () => {
  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: '/month',
      description: 'Perfect for getting started',
      cta: 'Get Started',
      features: [
        'Up to 5 projects',
        'Basic analytics',
        'Community support',
        '1 GB storage',
      ],
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '₹499',
      period: '/month',
      description: 'Best for growing teams',
      cta: 'Start Free Trial',
      features: [
        'Unlimited projects',
        'Advanced analytics',
        'Priority support',
        '100 GB storage',
        'Custom integrations',
        'Team collaboration',
      ],
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Team',
      price: '₹299',
      period: '/user/month',
      description: 'For scaling organizations',
      cta: 'Contact Sales',
      features: [
        'Everything in Pro',
        'Advanced security',
        'Dedicated account manager',
        'Unlimited storage',
        'SSO & SAML',
        'Custom contracts',
      ],
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-zinc-400 text-balance">
            Choose the perfect plan for your needs. Always flexible to scale.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col h-full rounded-lg transition-all duration-300 ${plan.highlighted
                  ? 'md:scale-105 md:shadow-2xl'
                  : ''
                }`}
            >
              {/* Card Border & Background */}
              <div
                className={`flex flex-col h-full p-8 rounded-lg border backdrop-blur-sm ${plan.highlighted
                    ? 'border-blue-500 bg-gradient-to-br from-zinc-900 via-zinc-900 to-blue-950/20 shadow-xl shadow-blue-500/10'
                    : 'border-zinc-800 bg-zinc-900/50'
                  }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-zinc-400 mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-zinc-400 text-sm">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full py-3 px-4 rounded-lg font-semibold mb-8 transition-all duration-200 ${plan.highlighted
                      ? 'bg-white text-zinc-950 hover:bg-zinc-100 shadow-lg'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                    }`}
                >
                  {plan.cta}
                </button>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-8"></div>

                {/* Features */}
                <div className="space-y-4 flex-1">
                  {plan.features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${plan.highlighted
                              ? 'bg-blue-500/20'
                              : 'bg-zinc-800'
                            }`}
                        >
                          <Check
                            size={16}
                            className={`${plan.highlighted
                                ? 'text-blue-400'
                                : 'text-zinc-400'
                              }`}
                          />
                        </div>
                      </div>
                      <span className="text-zinc-300 text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-16">
          <p className="text-zinc-400 mb-4">
            Need a custom plan?{' '}
            <button className="text-blue-400 hover:text-blue-300 font-semibold underline decoration-blue-400 decoration-1 underline-offset-2">
              Contact our sales team
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingCards;
