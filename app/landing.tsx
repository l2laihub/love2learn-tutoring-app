import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../src/theme';
import { useResponsive } from '../src/hooks/useResponsive';

// Quick benefits
const quickBenefits = [
  { icon: 'phone-portrait-outline' as const, label: 'iOS, Android & Web' },
  { icon: 'timer-outline' as const, label: 'Setup in 5 minutes' },
  { icon: 'card-outline' as const, label: 'No credit card needed' },
];

// Feature data
const features = [
  {
    icon: 'calendar' as const,
    title: 'Smart Scheduling',
    description: 'Calendar with recurring lessons, reschedule requests, and availability management. Parents can request lessons right from the app.',
    color: colors.primary.main,
  },
  {
    icon: 'card' as const,
    title: 'Payment Tracking',
    description: 'Invoice and prepaid payment modes, automatic reminders, and clear payment history. Never chase payments again.',
    color: colors.secondary.main,
  },
  {
    icon: 'people' as const,
    title: 'Parent Portal',
    description: 'Real-time messaging, lesson updates, and assignment sharing. Keep families in the loop effortlessly.',
    color: colors.subjects.english.primary,
  },
  {
    icon: 'folder' as const,
    title: 'Resource Library',
    description: 'Share worksheets, practice materials, and resources with families. Everything organized in one place.',
    color: colors.subjects.speech.primary,
  },
  {
    icon: 'sparkles' as const,
    title: 'AI Worksheets',
    description: 'Generate custom piano and math worksheets with AI. Personalized learning materials in seconds.',
    isPro: true,
    color: colors.accent.main,
  },
];

// Pain points
const painPoints = [
  {
    problem: 'Scattered scheduling across texts, emails, and paper calendars',
    solution: 'One calendar for everything, with automatic reminders',
  },
  {
    problem: 'Chasing parents for payments and losing track of who owes what',
    solution: 'Clear payment tracking with automatic invoice generation',
  },
  {
    problem: 'Difficulty keeping parents updated on student progress',
    solution: 'Built-in messaging and lesson notes shared instantly',
  },
];

// Pricing plans
const plans = [
  {
    name: 'Solo',
    price: 29,
    description: 'Perfect for tutors just getting started',
    features: [
      'Up to 20 students',
      'Unlimited lessons',
      'Payment tracking',
      'Parent portal access',
      'Resource sharing',
      'Email support',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 49,
    description: 'For growing tutoring businesses',
    features: [
      'Unlimited students',
      'Everything in Solo',
      'AI worksheet generation',
      'Priority support',
      'Advanced analytics',
      'Custom branding (coming soon)',
    ],
    highlighted: true,
  },
];

// Testimonials with accent colors
const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Piano Teacher, 5 years',
    quote: 'Love2Learn has completely transformed how I run my studio. I used to spend hours each week on admin work - now it takes minutes.',
    avatar: 'S',
    accentColor: colors.primary.main,
  },
  {
    name: 'David K.',
    role: 'Math Tutor, 12 students',
    quote: 'The payment tracking alone is worth it. No more awkward conversations about overdue payments - the app handles it all.',
    avatar: 'D',
    accentColor: colors.secondary.main,
  },
  {
    name: 'Jennifer L.',
    role: 'Reading Specialist',
    quote: 'Parents love being able to see lesson notes and assignments right in the app. My communication has never been better.',
    avatar: 'J',
    accentColor: colors.accent.main,
  },
];

// FAQs
const faqs = [
  {
    question: 'What platforms does Love2Learn work on?',
    answer: 'Love2Learn works on iOS, Android, and web browsers. You can manage your tutoring business from any device.',
  },
  {
    question: 'Can my students\' parents use the app?',
    answer: 'Yes! Parents get their own free account where they can view schedules, make payments, message you, and track their child\'s progress.',
  },
  {
    question: 'Is it really free to start?',
    answer: 'Yes! You get full access free for 14 days. No credit card needed to sign up. If you love it, choose a plan to continue. If not, no obligation at all.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. Cancel your subscription at any time with no penalties or hidden fees. Your data remains accessible for 30 days after cancellation.',
  },
];

// Animation hook for fade-in effect
const useFadeIn = (delay: number = 0) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return { opacity, transform: [{ translateY }] };
};

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const responsive = useResponsive();

  // Animation values
  const heroAnimation = useFadeIn(100);
  const phoneAnimation = useFadeIn(300);

  const isDesktop = responsive.isLgUp;
  const isTablet = responsive.isMdUp && !isDesktop;

  const handleStartTrial = () => {
    router.push('/(auth)/register');
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const containerMaxWidth = Math.min(1200, width - 32);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Header */}
        <View style={styles.navContainer}>
          <View style={[styles.nav, { maxWidth: containerMaxWidth }]}>
            <View style={styles.navBrand}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>L2L</Text>
              </View>
              <Text style={styles.brandName}>Love2Learn</Text>
            </View>
            <View style={styles.navLinks}>
              {isDesktop && (
                <>
                  <Pressable style={styles.navLink}>
                    <Text style={styles.navLinkText}>Features</Text>
                  </Pressable>
                  <Pressable style={styles.navLink}>
                    <Text style={styles.navLinkText}>Pricing</Text>
                  </Pressable>
                  <Pressable style={styles.navLink}>
                    <Text style={styles.navLinkText}>FAQ</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Sign In</Text>
              </Pressable>
              <Pressable style={styles.ctaButtonSmall} onPress={handleStartTrial}>
                <Text style={styles.ctaButtonSmallText}>Get Started Free</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Decorative Background Shapes */}
          <View style={styles.heroDecorCircle1} />
          <View style={styles.heroDecorCircle2} />
          <View style={styles.heroDecorCircle3} />

          <View style={[styles.heroContent, { maxWidth: containerMaxWidth }, isDesktop && styles.heroContentDesktop]}>
            <Animated.View style={[
              styles.heroTextContainer,
              isDesktop && styles.heroTextContainerDesktop,
              heroAnimation,
            ]}>
              <Text style={[styles.heroHeadline, isDesktop && styles.heroHeadlineDesktop]}>
                The <Text style={styles.heroAccent}>Simplest Way</Text> to Manage Your Tutoring Business
              </Text>
              <Text style={[styles.heroSubheadline, isDesktop && styles.heroSubheadlineDesktop]}>
                Scheduling, payments, parent communication{'\n'}— all in one app
              </Text>
              <View style={[styles.heroButtons, isDesktop && styles.heroButtonsDesktop]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButtonPrimary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleStartTrial}
                >
                  <Text style={styles.ctaButtonPrimaryText}>Get Started Free</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButtonSecondary,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="play-circle-outline" size={22} color={colors.primary.main} />
                  <Text style={styles.ctaButtonSecondaryText}>See How It Works</Text>
                </Pressable>
              </View>
              <Text style={styles.trialNote}>Free for 14 days. No credit card required.</Text>
            </Animated.View>

            {/* Phone Mockup Frame */}
            <Animated.View style={[
              styles.heroImageContainer,
              isDesktop && styles.heroImageContainerDesktop,
              phoneAnimation,
            ]}>
              <View style={styles.phoneFrame}>
                <View style={styles.phoneNotch}>
                  <View style={styles.phoneNotchInner} />
                </View>
                <View style={styles.phoneScreen}>
                  <View style={styles.appPreviewContent}>
                    <View style={styles.appPreviewCard}>
                      <View style={styles.appPreviewCardHeader}>
                        <View style={styles.appPreviewIconCircle}>
                          <Ionicons name="calendar" size={20} color={colors.primary.main} />
                        </View>
                        <Text style={styles.appPreviewTitle}>Today's Lessons</Text>
                      </View>
                      <View style={styles.appPreviewLesson}>
                        <View style={[styles.lessonDot, { backgroundColor: colors.piano.primary }]} />
                        <Text style={styles.lessonText}>3:00 PM - Piano with Emma</Text>
                      </View>
                      <View style={styles.appPreviewLesson}>
                        <View style={[styles.lessonDot, { backgroundColor: colors.math.primary }]} />
                        <Text style={styles.lessonText}>4:30 PM - Math with Jake</Text>
                      </View>
                      <View style={[styles.appPreviewLesson, { marginBottom: 0 }]}>
                        <View style={[styles.lessonDot, { backgroundColor: colors.subjects.reading.primary }]} />
                        <Text style={styles.lessonText}>6:00 PM - Reading with Lily</Text>
                      </View>
                    </View>
                    <View style={styles.appPreviewStats}>
                      <View style={[styles.statBox, { backgroundColor: colors.primary.subtle }]}>
                        <Text style={[styles.statNumber, { color: colors.primary.main }]}>12</Text>
                        <Text style={styles.statLabel}>Students</Text>
                      </View>
                      <View style={[styles.statBox, { backgroundColor: colors.secondary.subtle }]}>
                        <Text style={[styles.statNumber, { color: colors.secondary.main }]}>$2,400</Text>
                        <Text style={styles.statLabel}>This Month</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Quick Benefits Section */}
        <View style={styles.benefitsSection}>
          <View style={[styles.benefitsContent, { maxWidth: containerMaxWidth }]}>
            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              {quickBenefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.benefitIconCircle}>
                    <Ionicons name={benefit.icon} size={20} color={colors.primary.main} />
                  </View>
                  <Text style={styles.benefitLabel}>{benefit.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Problem/Solution Section */}
        <View style={styles.problemSection}>
          <View style={[styles.sectionContent, { maxWidth: containerMaxWidth }]}>
            <Text style={styles.sectionTitle}>Stop Juggling, Start Teaching</Text>
            <Text style={styles.sectionSubtitle}>
              You became a tutor to help students learn, not to manage spreadsheets
            </Text>

            <View style={[styles.problemGrid, isDesktop && styles.problemGridDesktop]}>
              {painPoints.map((point, index) => (
                <View key={index} style={[styles.problemCard, isDesktop && styles.problemCardDesktop]}>
                  <View style={styles.problemContent}>
                    <View style={styles.problemIconCircle}>
                      <Ionicons name="close" size={16} color={colors.status.error} />
                    </View>
                    <Text style={styles.problemText}>{point.problem}</Text>
                  </View>
                  <View style={styles.arrowContainer}>
                    <Ionicons name="arrow-down" size={20} color={colors.primary.main} />
                  </View>
                  <View style={styles.solutionContent}>
                    <View style={styles.solutionIconCircle}>
                      <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                    </View>
                    <Text style={styles.solutionText}>{point.solution}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          {/* Decorative shapes */}
          <View style={styles.featureDecorCircle1} />
          <View style={styles.featureDecorCircle2} />

          <View style={[styles.sectionContent, { maxWidth: containerMaxWidth }]}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.text }]}>Everything You Need to Grow</Text>
            <Text style={styles.sectionSubtitle}>
              Powerful features designed specifically for independent tutors
            </Text>

            <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
              {features.map((feature, index) => (
                <View
                  key={index}
                  style={[
                    styles.featureCard,
                    isDesktop && styles.featureCardDesktop,
                    feature.isPro && styles.featureCardPro,
                  ]}
                >
                  <View style={[
                    styles.featureIconContainer,
                    { borderColor: feature.color },
                    feature.isPro && styles.featureIconContainerPro,
                  ]}>
                    <Ionicons
                      name={feature.icon}
                      size={28}
                      color={feature.color}
                    />
                  </View>
                  <View style={styles.featureTitleRow}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    {feature.isPro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Pricing Section */}
        <View style={styles.pricingSection}>
          <View style={[styles.sectionContent, { maxWidth: containerMaxWidth }]}>
            <Text style={styles.sectionTitle}>Simple, Transparent Pricing</Text>
            <Text style={styles.sectionSubtitle}>
              Start free, upgrade when you're ready
            </Text>

            <View style={[styles.pricingGrid, isDesktop && styles.pricingGridDesktop]}>
              {plans.map((plan, index) => (
                <View
                  key={index}
                  style={[
                    styles.pricingCard,
                    plan.highlighted && styles.pricingCardHighlighted,
                    isDesktop && styles.pricingCardDesktop,
                  ]}
                >
                  {plan.highlighted && (
                    <>
                      <View style={styles.pricingCardDecor} />
                      <View style={styles.popularBadge}>
                        <Ionicons name="star" size={12} color={colors.neutral.white} style={{ marginRight: 4 }} />
                        <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                      </View>
                    </>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceCurrency, plan.highlighted && styles.priceHighlighted]}>$</Text>
                    <Text style={[styles.priceAmount, plan.highlighted && styles.priceHighlighted]}>{plan.price}</Text>
                    <Text style={styles.pricePeriod}>/month</Text>
                  </View>
                  <Text style={styles.planDescription}>{plan.description}</Text>

                  <View style={styles.planFeatures}>
                    {plan.features.map((feature, fIndex) => (
                      <View key={fIndex} style={styles.planFeatureRow}>
                        <View style={[
                          styles.planFeatureCheck,
                          plan.highlighted && styles.planFeatureCheckHighlighted,
                        ]}>
                          <Ionicons name="checkmark" size={14} color={plan.highlighted ? colors.neutral.white : colors.secondary.main} />
                        </View>
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.planButton,
                      plan.highlighted && styles.planButtonHighlighted,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleStartTrial}
                  >
                    <Text style={[
                      styles.planButtonText,
                      plan.highlighted && styles.planButtonTextHighlighted,
                    ]}>
                      Get Started Free
                    </Text>
                  </Pressable>
                  <Text style={styles.planTrialNote}>Free for 14 days, cancel anytime</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={styles.testimonialsSection}>
          <View style={[styles.sectionContent, { maxWidth: containerMaxWidth }]}>
            <Text style={styles.sectionTitle}>Loved by Tutors Everywhere</Text>
            <Text style={styles.sectionSubtitle}>
              See what educators are saying about Love2Learn
            </Text>

            <View style={[styles.testimonialsGrid, isDesktop && styles.testimonialsGridDesktop]}>
              {testimonials.map((testimonial, index) => (
                <View
                  key={index}
                  style={[
                    styles.testimonialCard,
                    isDesktop && styles.testimonialCardDesktop,
                    { borderTopColor: testimonial.accentColor },
                  ]}
                >
                  <Text style={styles.testimonialQuoteMark}>"</Text>
                  <Text style={styles.testimonialText}>{testimonial.quote}</Text>
                  <View style={styles.testimonialAuthor}>
                    <View style={[styles.testimonialAvatar, { backgroundColor: testimonial.accentColor }]}>
                      <Text style={styles.testimonialAvatarText}>{testimonial.avatar}</Text>
                    </View>
                    <View>
                      <Text style={styles.testimonialName}>{testimonial.name}</Text>
                      <Text style={styles.testimonialRole}>{testimonial.role}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <View style={[styles.sectionContent, { maxWidth: Math.min(800, containerMaxWidth) }]}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            <Text style={styles.sectionSubtitle}>
              Got questions? We've got answers
            </Text>

            <View style={styles.faqList}>
              {faqs.map((faq, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.faqItem,
                    expandedFaq === index && styles.faqItemActive,
                  ]}
                  onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <View style={styles.faqQuestion}>
                    <Text style={[
                      styles.faqQuestionText,
                      expandedFaq === index && styles.faqQuestionTextActive,
                    ]}>{faq.question}</Text>
                    <View style={[
                      styles.faqChevron,
                      expandedFaq === index && styles.faqChevronActive,
                    ]}>
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={expandedFaq === index ? colors.primary.main : colors.neutral.textMuted}
                      />
                    </View>
                  </View>
                  {expandedFaq === index && (
                    <View style={styles.faqAnswerContainer}>
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          {/* Decorative elements */}
          <View style={styles.ctaDecorCircle1} />
          <View style={styles.ctaDecorCircle2} />
          <View style={styles.ctaDecorCircle3} />

          <View style={[styles.sectionContent, { maxWidth: Math.min(600, containerMaxWidth) }]}>
            <Text style={styles.ctaTitle}>Ready to simplify your tutoring business?</Text>
            <Text style={styles.ctaSubtitle}>
              Join hundreds of tutors who've reclaimed their time with Love2Learn
            </Text>

            <View style={[styles.emailCapture, isDesktop && styles.emailCaptureDesktop]}>
              <View style={styles.emailInputContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.neutral.textMuted} />
                <TextInput
                  style={styles.emailInput}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.neutral.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.emailButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleStartTrial}
              >
                <Text style={styles.emailButtonText}>Get Started Free</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.neutral.white} />
              </Pressable>
            </View>
            <Text style={styles.ctaNote}>
              Free for 14 days. No credit card needed. Cancel anytime.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Accent bar */}
          <View style={styles.footerAccentBar}>
            <View style={[styles.footerAccentSegment, { backgroundColor: colors.primary.main }]} />
            <View style={[styles.footerAccentSegment, { backgroundColor: colors.secondary.main }]} />
            <View style={[styles.footerAccentSegment, { backgroundColor: colors.accent.main }]} />
          </View>

          <View style={[styles.footerContent, { maxWidth: containerMaxWidth }]}>
            <View style={styles.footerTop}>
              <View style={styles.footerBrand}>
                <View style={styles.logoCircleSmall}>
                  <Text style={styles.logoTextSmall}>L2L</Text>
                </View>
                <Text style={styles.footerBrandName}>Love2Learn</Text>
              </View>
              <View style={styles.footerLinks}>
                <Pressable style={styles.footerLink}>
                  <Text style={styles.footerLinkText}>Privacy Policy</Text>
                </Pressable>
                <Pressable style={styles.footerLink}>
                  <Text style={styles.footerLinkText}>Terms of Service</Text>
                </Pressable>
                <Pressable style={styles.footerLink}>
                  <Text style={styles.footerLinkText}>Contact</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.footerDivider} />
            <Text style={styles.footerCopyright}>
              {'\u00A9'} {new Date().getFullYear()} Love2Learn. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  scrollView: {
    flex: 1,
  },

  // Button pressed state
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },

  // Navigation
  navContainer: {
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: '100%',
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary.light,
    ...shadows.md,
  },
  logoText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  brandName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginLeft: spacing.sm,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navLink: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navLinkText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  loginButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loginButtonText: {
    fontSize: typography.sizes.base,
    color: colors.primary.main,
    fontWeight: typography.weights.semibold,
  },
  ctaButtonSmall: {
    backgroundColor: colors.accent.main,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  ctaButtonSmallText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    fontWeight: typography.weights.semibold,
  },

  // Hero Section
  heroSection: {
    backgroundColor: colors.neutral.background,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle1: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primary.subtle,
    opacity: 0.7,
  },
  heroDecorCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.secondary.subtle,
    opacity: 0.6,
  },
  heroDecorCircle3: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.subtle,
    opacity: 0.4,
  },
  heroContent: {
    alignSelf: 'center',
    width: '100%',
    zIndex: 1,
  },
  heroContentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  heroTextContainerDesktop: {
    alignItems: 'flex-start',
    flex: 1,
    marginBottom: 0,
    marginRight: spacing['3xl'],
  },
  heroHeadline: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: typography.sizes['2xl'] * typography.lineHeights.tight,
  },
  heroHeadlineDesktop: {
    fontSize: 56,
    textAlign: 'left',
    lineHeight: 64,
    letterSpacing: -1,
  },
  heroAccent: {
    color: colors.primary.main,
  },
  heroSubheadline: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.sizes.md * typography.lineHeights.relaxed,
  },
  heroSubheadlineDesktop: {
    fontSize: typography.sizes.xl,
    textAlign: 'left',
    lineHeight: typography.sizes.xl * typography.lineHeights.relaxed,
  },
  heroButtons: {
    flexDirection: 'column',
    gap: spacing.md,
    width: '100%',
    maxWidth: 320,
    marginBottom: spacing.base,
  },
  heroButtonsDesktop: {
    flexDirection: 'row',
    maxWidth: 500,
  },
  ctaButtonPrimary: {
    backgroundColor: colors.accent.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base + 2,
    paddingHorizontal: spacing.xl + spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.lg,
  },
  ctaButtonPrimaryText: {
    fontSize: typography.sizes.md,
    color: colors.neutral.white,
    fontWeight: typography.weights.semibold,
  },
  ctaButtonSecondary: {
    backgroundColor: colors.neutral.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  ctaButtonSecondaryText: {
    fontSize: typography.sizes.md,
    color: colors.primary.main,
    fontWeight: typography.weights.semibold,
  },
  trialNote: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  heroImageContainer: {
    alignItems: 'center',
  },
  heroImageContainerDesktop: {
    flex: 0,
  },

  // Phone Mockup
  phoneFrame: {
    backgroundColor: colors.brand.navy,
    borderRadius: 36,
    padding: 10,
    ...shadows.xl,
    transform: [{ rotate: '-2deg' }],
  },
  phoneNotch: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  phoneNotchInner: {
    width: 80,
    height: 24,
    backgroundColor: colors.brand.navy,
    borderRadius: 12,
  },
  phoneScreen: {
    backgroundColor: colors.neutral.white,
    borderRadius: 28,
    overflow: 'hidden',
    width: 280,
  },
  appPreviewContent: {
    padding: spacing.base,
  },
  appPreviewCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  appPreviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  appPreviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appPreviewTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  appPreviewLesson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lessonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lessonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  appPreviewStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },

  // Quick Benefits Section
  benefitsSection: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  benefitsContent: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.base,
  },
  benefitsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xl,
  },
  benefitsGridDesktop: {
    gap: spacing['3xl'],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },

  // Problem/Solution Section
  problemSection: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
  },
  sectionContent: {
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  problemGrid: {
    gap: spacing.lg,
  },
  problemGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  problemCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  problemCardDesktop: {
    flex: 1,
    minWidth: 300,
  },
  problemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  problemIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.status.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  solutionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.secondary.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary.main,
  },
  solutionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solutionText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    fontWeight: typography.weights.medium,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },

  // Features Section
  featuresSection: {
    backgroundColor: colors.primary.subtle,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
    position: 'relative',
    overflow: 'hidden',
  },
  featureDecorCircle1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary.light,
    opacity: 0.15,
  },
  featureDecorCircle2: {
    position: 'absolute',
    bottom: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.secondary.light,
    opacity: 0.12,
  },
  featuresGrid: {
    gap: spacing.lg,
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.md,
    position: 'relative',
    zIndex: 1,
  },
  featureCardDesktop: {
    flex: 1,
    minWidth: 280,
    maxWidth: '32%',
  },
  featureCardPro: {
    borderWidth: 2,
    borderColor: colors.accent.main,
    backgroundColor: colors.accent.subtle,
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
  },
  featureIconContainerPro: {
    backgroundColor: colors.accent.subtle,
    borderColor: colors.accent.main,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  proBadge: {
    backgroundColor: colors.accent.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    ...shadows.sm,
  },
  proBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  featureDescription: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },

  // Pricing Section
  pricingSection: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
  },
  pricingGrid: {
    gap: spacing.xl,
  },
  pricingGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pricingCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    position: 'relative',
    overflow: 'hidden',
  },
  pricingCardHighlighted: {
    borderColor: colors.primary.main,
    borderWidth: 3,
    ...shadows.xl,
    transform: [{ scale: 1.02 }],
  },
  pricingCardDesktop: {
    flex: 1,
    maxWidth: 380,
  },
  pricingCardDecor: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    backgroundColor: colors.primary.subtle,
    borderBottomLeftRadius: 120,
    opacity: 0.5,
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.main,
    paddingVertical: spacing.sm,
    borderTopLeftRadius: borderRadius['2xl'] - 2,
    borderTopRightRadius: borderRadius['2xl'] - 2,
  },
  popularBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
    letterSpacing: 1,
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  priceCurrency: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.sm,
  },
  priceAmount: {
    fontSize: 56,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    lineHeight: 56,
  },
  priceHighlighted: {
    color: colors.primary.main,
  },
  pricePeriod: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.xl,
  },
  planDescription: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  planFeatures: {
    marginBottom: spacing.xl,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planFeatureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFeatureCheckHighlighted: {
    backgroundColor: colors.secondary.main,
  },
  planFeatureText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    flex: 1,
  },
  planButton: {
    backgroundColor: colors.neutral.background,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  planButtonHighlighted: {
    backgroundColor: colors.accent.main,
    borderColor: colors.accent.main,
    ...shadows.md,
  },
  planButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  planButtonTextHighlighted: {
    color: colors.neutral.white,
  },
  planTrialNote: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Testimonials Section
  testimonialsSection: {
    backgroundColor: colors.neutral.background,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
  },
  testimonialsGrid: {
    gap: spacing.lg,
  },
  testimonialsGridDesktop: {
    flexDirection: 'row',
  },
  testimonialCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    ...shadows.md,
    borderTopWidth: 4,
    position: 'relative',
  },
  testimonialCardDesktop: {
    flex: 1,
  },
  testimonialQuoteMark: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    fontSize: 80,
    color: colors.primary.subtle,
    fontFamily: 'Georgia',
    lineHeight: 80,
  },
  testimonialText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    fontStyle: 'italic',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  testimonialAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  testimonialAvatarText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  testimonialName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  testimonialRole: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },

  // FAQ Section
  faqSection: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
  },
  faqList: {
    gap: spacing.md,
  },
  faqItem: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  faqItemActive: {
    backgroundColor: colors.primary.subtle,
    borderColor: colors.primary.light,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginRight: spacing.md,
  },
  faqQuestionTextActive: {
    color: colors.primary.dark,
    fontWeight: typography.weights.semibold,
  },
  faqChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqChevronActive: {
    backgroundColor: colors.primary.main,
    transform: [{ rotate: '180deg' }],
  },
  faqAnswerContainer: {
    backgroundColor: colors.neutral.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.light,
  },
  faqAnswer: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    padding: spacing.base,
  },

  // CTA Section
  ctaSection: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.base,
    position: 'relative',
    overflow: 'hidden',
  },
  ctaDecorCircle1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primary.light,
    opacity: 0.2,
  },
  ctaDecorCircle2: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary.dark,
    opacity: 0.3,
  },
  ctaDecorCircle3: {
    position: 'absolute',
    top: '30%',
    left: '60%',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary.light,
    opacity: 0.15,
  },
  ctaTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  ctaSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.primary.light,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emailCapture: {
    flexDirection: 'column',
    gap: spacing.md,
    marginBottom: spacing.base,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
  },
  emailCaptureDesktop: {
    flexDirection: 'row',
  },
  emailInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 56,
    gap: spacing.sm,
    ...shadows.sm,
  },
  emailInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    height: '100%',
  },
  emailButton: {
    backgroundColor: colors.accent.main,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.lg,
  },
  emailButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  ctaNote: {
    fontSize: typography.sizes.sm,
    color: colors.primary.light,
    textAlign: 'center',
  },

  // Footer
  footer: {
    backgroundColor: colors.brand.navy,
  },
  footerAccentBar: {
    flexDirection: 'row',
    height: 4,
  },
  footerAccentSegment: {
    flex: 1,
  },
  footerContent: {
    alignSelf: 'center',
    width: '100%',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.base,
  },
  footerTop: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.lg,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary.light,
  },
  logoTextSmall: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  footerBrandName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
    marginLeft: spacing.sm,
  },
  footerLinks: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  footerLink: {
    paddingVertical: spacing.xs,
  },
  footerLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  footerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.lg,
  },
  footerCopyright: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
});
