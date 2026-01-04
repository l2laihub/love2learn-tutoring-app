/**
 * AgreementContent Component
 * Displays the tutoring service agreement terms and conditions
 *
 * This is the legal content that parents must review and sign
 * Content can be loaded from database templates or use default fallback
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export interface AgreementContentProps {
  /** Version of the agreement */
  version?: string;
  /** Tutor/Academy name */
  tutorName?: string;
  /** Whether to show version info */
  showVersion?: boolean;
  /** Custom content to display (overrides database fetch) */
  content?: string;
  /** Agreement type to fetch from database */
  agreementType?: string;
}

export interface AgreementTemplateInfo {
  id: string;
  name: string;
  version: string;
  content: string;
  agreementType: string;
}

// Fallback agreement content when database is unavailable
export const AGREEMENT_VERSION = '1.0';
export const AGREEMENT_EFFECTIVE_DATE = 'January 2026';

export const getDefaultAgreementText = (tutorName: string = 'Love to Learn Academy'): string => {
  return `
TUTORING SERVICES AGREEMENT

This Tutoring Services Agreement ("Agreement") is entered into between ${tutorName} ("Tutor/Academy") and the undersigned parent/guardian ("Parent").

1. SERVICES

1.1 The Tutor agrees to provide educational tutoring services to the Parent's child(ren) as specified during enrollment.

1.2 Tutoring sessions will be conducted at mutually agreed upon times and locations (in-person or online).

1.3 Session duration, frequency, and subject matter will be as agreed upon between the Tutor and Parent.

2. PAYMENT TERMS

2.1 Payment for tutoring services is due according to the schedule agreed upon during enrollment.

2.2 Rates may be adjusted with 30 days' written notice.

2.3 Payment methods accepted: Cash, Check, Venmo, Zelle, or other agreed methods.

3. CANCELLATION POLICY

3.1 Parents must provide at least 24 hours' notice for session cancellations.

3.2 Sessions cancelled with less than 24 hours' notice may be charged at the full session rate.

3.3 The Tutor will make reasonable efforts to reschedule cancelled sessions.

4. ATTENDANCE & PUNCTUALITY

4.1 Students are expected to attend all scheduled sessions.

4.2 If a student is more than 15 minutes late without notice, the session may be shortened or cancelled.

4.3 Chronic lateness or no-shows may result in termination of services.

5. MATERIALS & RESOURCES

5.1 The Tutor will provide appropriate learning materials, worksheets, and resources.

5.2 Any additional materials requiring purchase will be discussed with the Parent in advance.

5.3 Digital materials provided are for personal educational use only and may not be redistributed.

6. PROGRESS & COMMUNICATION

6.1 The Tutor will provide regular updates on student progress through the Parent Portal.

6.2 Parents are encouraged to communicate any concerns or questions.

6.3 Progress reports will be shared as appropriate for the tutoring arrangement.

7. CONFIDENTIALITY

7.1 All student information will be kept confidential and used only for educational purposes.

7.2 Student progress information may be shared with parents/guardians and, if applicable, school personnel with consent.

8. SAFETY & CONDUCT

8.1 A safe, respectful learning environment will be maintained at all times.

8.2 Any behavioral issues will be addressed promptly with the Parent.

8.3 The Tutor reserves the right to terminate services for severe or persistent misconduct.

9. LIMITATION OF LIABILITY

9.1 While the Tutor will make best efforts to help students succeed, no specific academic outcomes are guaranteed.

9.2 The Tutor is not responsible for students' academic performance outside of tutoring sessions.

10. TERMINATION

10.1 Either party may terminate this Agreement with 7 days' written notice.

10.2 The Tutor may terminate immediately for non-payment, misconduct, or other serious breaches.

10.3 Upon termination, any outstanding balances must be paid in full.

11. PHOTO/VIDEO CONSENT

11.1 By signing this Agreement, Parent consents to occasional photos or videos of tutoring sessions for educational documentation purposes only.

11.2 No photos or videos will be shared publicly without additional written consent.

12. DIGITAL SIGNATURE ACKNOWLEDGMENT

12.1 Parent acknowledges that electronic signatures on this Agreement are legally binding.

12.2 By providing a digital signature below, Parent confirms they have read, understood, and agree to all terms of this Agreement.

13. GENERAL PROVISIONS

13.1 This Agreement constitutes the entire agreement between the parties.

13.2 Any modifications must be in writing and agreed upon by both parties.

13.3 This Agreement shall be governed by the laws of the state in which services are provided.

Agreement Version: ${AGREEMENT_VERSION}
Effective Date: ${AGREEMENT_EFFECTIVE_DATE}
`.trim();
};

// Hook to fetch active agreement template from database
export function useActiveAgreementTemplate(agreementType: string = 'tutoring_services') {
  const [template, setTemplate] = useState<AgreementTemplateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplate() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_active_agreement_template', {
          p_agreement_type: agreementType,
        });

        if (rpcError) {
          console.warn('Failed to fetch template from database, using default:', rpcError.message);
          // Use default template on error
          setTemplate({
            id: 'default',
            name: 'Tutoring Services Agreement',
            version: AGREEMENT_VERSION,
            content: getDefaultAgreementText(),
            agreementType: agreementType,
          });
        } else if (data && data.length > 0) {
          const row = data[0];
          setTemplate({
            id: row.template_id,
            name: row.template_name,
            version: row.template_version,
            content: row.template_content,
            agreementType: agreementType,
          });
        } else {
          // No template found, use default
          setTemplate({
            id: 'default',
            name: 'Tutoring Services Agreement',
            version: AGREEMENT_VERSION,
            content: getDefaultAgreementText(),
            agreementType: agreementType,
          });
        }
      } catch (err) {
        console.error('Error fetching agreement template:', err);
        // Use default on any error
        setTemplate({
          id: 'default',
          name: 'Tutoring Services Agreement',
          version: AGREEMENT_VERSION,
          content: getDefaultAgreementText(),
          agreementType: agreementType,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchTemplate();
  }, [agreementType]);

  return { template, loading, error };
}

// Legacy function for backward compatibility
export const getAgreementText = getDefaultAgreementText;

const AgreementContent: React.FC<AgreementContentProps> = ({
  version,
  tutorName = 'Love to Learn Academy',
  showVersion = true,
  content,
  agreementType = 'tutoring_services',
}) => {
  const { template, loading } = useActiveAgreementTemplate(agreementType);

  // Use provided content, or fetched template content, or fallback to default
  const agreementText = content || template?.content || getDefaultAgreementText(tutorName);
  const displayVersion = version || template?.version || AGREEMENT_VERSION;

  const sections = agreementText.split('\n\n');

  if (loading && !content) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3D9CA8" />
        <Text style={styles.loadingText}>Loading agreement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showVersion && (
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>Version {displayVersion}</Text>
        </View>
      )}

      {sections.map((section, index) => {
        const isTitle = section === 'TUTORING SERVICES AGREEMENT';
        const isMainSection = /^\d+\.\s+[A-Z\s&]+$/.test(section.split('\n')[0]);
        const lines = section.split('\n');

        if (isTitle) {
          return (
            <Text key={index} style={styles.title}>
              {section}
            </Text>
          );
        }

        if (isMainSection) {
          return (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{lines[0]}</Text>
              {lines.slice(1).map((line, lineIndex) => (
                <Text key={lineIndex} style={styles.sectionContent}>
                  {line}
                </Text>
              ))}
            </View>
          );
        }

        return (
          <Text key={index} style={styles.paragraph}>
            {section}
          </Text>
        );
      })}
    </View>
  );
};

export const AgreementScrollView: React.FC<AgreementContentProps & {
  onScrollEnd?: () => void;
  onTemplateLoaded?: (template: AgreementTemplateInfo) => void;
}> = ({ onScrollEnd, onTemplateLoaded, ...props }) => {
  const { template, loading } = useActiveAgreementTemplate(props.agreementType);

  // Notify parent when template is loaded
  useEffect(() => {
    if (template && onTemplateLoaded) {
      onTemplateLoaded(template);
    }
  }, [template, onTemplateLoaded]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isAtEnd && onScrollEnd) {
      onScrollEnd();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScrollContainer}>
        <ActivityIndicator size="large" color="#3D9CA8" />
        <Text style={styles.loadingText}>Loading agreement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <AgreementContent {...props} content={template?.content} version={template?.version} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4A6572',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  versionBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B3A4B',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D9CA8',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4A6572',
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4A6572',
    marginBottom: 16,
  },
});

export default AgreementContent;
