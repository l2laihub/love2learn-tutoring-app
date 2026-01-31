import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../src/theme';
import { useResponsive } from '../src/hooks/useResponsive';

// Feature data
const features = [
  {
    icon: 'calendar' as const,
    title: 'Smart Scheduling',
    description: 'Calendar with recurring lessons, reschedule requests, and availability management. Parents can request lessons right from the app.',
  },
  {
    icon: 'card' as const,
    title: 'Payment Tracking',
    description: 'Invoice and prepaid payment modes, automatic reminders, and clear payment history. Never chase payments again.',
  },
  {
    icon: 'people' as const,
    title: 'Parent Portal',
    description: 'Real-time messaging, lesson updates, and assignment sharing. Keep families in the loop effortlessly.',
  },
  {
    icon: 'folder' as const,
    title: 'Resource Library',
    description: 'Share worksheets, practice materials, and resources with families. Everything organized in one place.',
  },
  {
    icon: 'sparkles' as const,
    title: 'AI Worksheets',
    description: 'Generate custom piano and math worksheets with AI. Personalized learning materials in seconds.',
    isPro: true,
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

// Testimonials
const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Piano Teacher, 5 years',
    quote: 'Love2Learn has completely transformed how I run my studio. I used to spend hours each week on admin work - now it takes minutes.',
    avatar: 'S',
  },
  {
    name: 'David K.',
    role: 'Math Tutor, 12 students',
    quote: 'The payment tracking alone is worth it. No more awkward conversations about overdue payments - the app handles it all.',
    avatar: 'D',
  },
  {
    name: 'Jennifer L.',
    role: 'Reading Specialist',
    quote: 'Parents love being able to see lesson notes and assignments right in the app. My communication has never been better.',
    avatar: 'J',
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
    question: 'How does the free trial work?',
    answer: 'Start with a 14-day free trial of any plan. No credit card required. If you love it, subscribe to continue. If not, no obligation.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. Cancel your subscription at any time with no penalties or hidden fees. Your data remains accessible for 30 days after cancellation.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const responsive = useResponsive();

  const isDesktop = responsive.isLgUp;
  const isTablet = responsive.isMdUp && !isDesktop;

  const scrollToSection = (sectionId: string) => {
    // For web, we could implement smooth scrolling to sections
    // For now, this is a placeholder for the navigation
  };

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
                <Text style={styles.ctaButtonSmallText}>Start Free Trial</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroContent, { maxWidth: containerMaxWidth }]}>
            <View style={[styles.heroTextContainer, isDesktop && styles.heroTextContainerDesktop]}>
              <Text style={[styles.heroHeadline, isDesktop && styles.heroHeadlineDesktop]}>
                The Simplest Way to Manage Your Tutoring Business
              </Text>
              <Text style={[styles.heroSubheadline, isDesktop && styles.heroSubheadlineDesktop]}>
                Scheduling, payments, parent communication{'\n'}— all in one app
              </Text>
              <View style={[styles.heroButtons, isDesktop && styles.heroButtonsDesktop]}>
                <Pressable style={styles.ctaButtonPrimary} onPress={handleStartTrial}>
                  <Text style={styles.ctaButtonPrimaryText}>Start Free Trial</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
                </Pressable>
                <Pressable style={styles.ctaButtonSecondary}>
                  <Ionicons name="play-circle-outline" size={22} color={colors.primary.main} />
                  <Text style={styles.ctaButtonSecondaryText}>See How It Works</Text>
                </Pressable>
              </View>
              <Text style={styles.trialNote}>14-day free trial. No credit card required.</Text>
            </View>

            {/* App Screenshot Placeholder */}
            <View style={[styles.heroImageContainer, isDesktop && styles.heroImageContainerDesktop]}>
              <View style={styles.appPreview}>
                <View style={styles.appPreviewHeader}>
                  <View style={styles.appPreviewDot} />
                  <View style={[styles.appPreviewDot, { backgroundColor: colors.secondary.main }]} />
                  <View style={[styles.appPreviewDot, { backgroundColor: colors.accent.main }]} />
                </View>
                <View style={styles.appPreviewContent}>
                  <View style={styles.appPreviewCard}>
                    <View style={styles.appPreviewCardHeader}>
                      <Ionicons name="calendar" size={24} color={colors.primary.main} />
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
                  </View>
                  <View style={styles.appPreviewStats}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNumber}>12</Text>
                      <Text style={styles.statLabel}>Students</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNumber}>$2,400</Text>
                      <Text style={styles.statLabel}>This Month</Text>
                    </View>
                  </View>
                </View>
              </View>
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
                    <Ionicons name="close-circle" size={24} color={colors.status.error} />
                    <Text style={styles.problemText}>{point.problem}</Text>
                  </View>
                  <View style={styles.solutionContent}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                    <Text style={styles.solutionText}>{point.solution}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={[styles.sectionContent, { maxWidth: containerMaxWidth }]}>
            <Text style={styles.sectionTitle}>Everything You Need to Grow</Text>
            <Text style={styles.sectionSubtitle}>
              Powerful features designed specifically for independent tutors
            </Text>

            <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
              {features.map((feature, index) => (
                <View key={index} style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
                  <View style={[styles.featureIconContainer, feature.isPro && styles.featureIconContainerPro]}>
                    <Ionicons
                      name={feature.icon}
                      size={28}
                      color={feature.isPro ? colors.accent.main : colors.primary.main}
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
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceCurrency}>$</Text>
                    <Text style={styles.priceAmount}>{plan.price}</Text>
                    <Text style={styles.pricePeriod}>/month</Text>
                  </View>
                  <Text style={styles.planDescription}>{plan.description}</Text>

                  <View style={styles.planFeatures}>
                    {plan.features.map((feature, fIndex) => (
                      <View key={fIndex} style={styles.planFeatureRow}>
                        <Ionicons name="checkmark" size={18} color={colors.secondary.main} />
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={[
                      styles.planButton,
                      plan.highlighted && styles.planButtonHighlighted,
                    ]}
                    onPress={handleStartTrial}
                  >
                    <Text style={[
                      styles.planButtonText,
                      plan.highlighted && styles.planButtonTextHighlighted,
                    ]}>
                      Start Free Trial
                    </Text>
                  </Pressable>
                  <Text style={styles.planTrialNote}>14-day free trial included</Text>
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
                <View key={index} style={[styles.testimonialCard, isDesktop && styles.testimonialCardDesktop]}>
                  <View style={styles.testimonialQuote}>
                    <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary.light} />
                  </View>
                  <Text style={styles.testimonialText}>"{testimonial.quote}"</Text>
                  <View style={styles.testimonialAuthor}>
                    <View style={styles.testimonialAvatar}>
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
                  style={styles.faqItem}
                  onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <View style={styles.faqQuestion}>
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    <Ionicons
                      name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.neutral.textMuted}
                    />
                  </View>
                  {expandedFaq === index && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <View style={[styles.sectionContent, { maxWidth: Math.min(600, containerMaxWidth) }]}>
            <Text style={styles.ctaTitle}>Ready to simplify your tutoring business?</Text>
            <Text style={styles.ctaSubtitle}>
              Join hundreds of tutors who've reclaimed their time with Love2Learn
            </Text>

            <View style={styles.emailCapture}>
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
              <Pressable style={styles.emailButton} onPress={handleStartTrial}>
                <Text style={styles.emailButtonText}>Start Free Trial</Text>
              </Pressable>
            </View>
            <Text style={styles.ctaNote}>
              Free 14-day trial. No credit card required. Cancel anytime.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  ctaButtonSmallText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    fontWeight: typography.weights.semibold,
  },

  // Hero Section
  heroSection: {
    backgroundColor: colors.neutral.background,
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
  },
  heroContent: {
    alignSelf: 'center',
    width: '100%',
  },
  heroTextContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  heroTextContainerDesktop: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    flex: 1,
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
    fontSize: typography.sizes['4xl'],
    textAlign: 'left',
    lineHeight: typography.sizes['4xl'] * typography.lineHeights.tight,
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
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.md,
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
    borderWidth: 1,
    borderColor: colors.neutral.border,
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
    marginTop: spacing.xl,
  },
  heroImageContainerDesktop: {
    marginTop: 0,
  },
  appPreview: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    ...shadows.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  appPreviewHeader: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  appPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
  },
  appPreviewContent: {
    padding: spacing.base,
  },
  appPreviewCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  appPreviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lessonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  appPreviewStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary.main,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },

  // Problem/Solution Section
  problemSection: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing['4xl'],
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
  },
  sectionSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  problemGrid: {
    gap: spacing.base,
  },
  problemGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  problemCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  problemCardDesktop: {
    flex: 1,
    minWidth: 300,
  },
  problemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  problemText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  solutionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
  },
  featuresGrid: {
    gap: spacing.base,
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  featureCardDesktop: {
    flex: 1,
    minWidth: 280,
    maxWidth: '32%',
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureIconContainerPro: {
    backgroundColor: colors.accent.subtle,
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
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
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
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
  },
  pricingGrid: {
    gap: spacing.lg,
  },
  pricingGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pricingCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    position: 'relative',
  },
  pricingCardHighlighted: {
    borderColor: colors.primary.main,
    ...shadows.lg,
  },
  pricingCardDesktop: {
    flex: 1,
    maxWidth: 380,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  priceCurrency: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.xs,
  },
  priceAmount: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    lineHeight: typography.sizes['4xl'],
  },
  pricePeriod: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.lg,
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planFeatureText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    flex: 1,
  },
  planButton: {
    backgroundColor: colors.neutral.background,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  planButtonHighlighted: {
    backgroundColor: colors.accent.main,
    borderColor: colors.accent.main,
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
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
  },
  testimonialsGrid: {
    gap: spacing.base,
  },
  testimonialsGridDesktop: {
    flexDirection: 'row',
  },
  testimonialCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  testimonialCardDesktop: {
    flex: 1,
  },
  testimonialQuote: {
    marginBottom: spacing.md,
  },
  testimonialText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  testimonialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialAvatarText: {
    fontSize: typography.sizes.md,
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
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
  },
  faqList: {
    gap: spacing.sm,
  },
  faqItem: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginRight: spacing.md,
  },
  faqAnswer: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    padding: spacing.base,
    paddingTop: 0,
  },

  // CTA Section
  ctaSection: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.base,
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
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  emailInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    height: '100%',
  },
  emailButton: {
    backgroundColor: colors.accent.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.md,
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
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.base,
  },
  footerContent: {
    alignSelf: 'center',
    width: '100%',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.lg,
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
