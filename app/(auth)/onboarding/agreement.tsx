/**
 * Agreement Screen
 * Parent reviews and digitally signs the tutoring service agreement
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useParentAgreement } from '../../../src/hooks/useParentAgreement';
import { AgreementScrollView, AGREEMENT_VERSION, getAgreementText } from '../../../src/components/AgreementContent';
import SignaturePad from '../../../src/components/SignaturePad';

const { width: screenWidth } = Dimensions.get('window');

interface ParentInfo {
  id: string;
  name: string;
  email: string;
}

export default function AgreementScreen() {
  // Parent info
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [loadingParent, setLoadingParent] = useState(true);

  // Agreement state
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'read' | 'sign'>('read');

  // Hook for agreement operations
  const {
    loading: agreementLoading,
    error: agreementError,
    createAgreement,
    signAgreement,
    clearError,
  } = useParentAgreement();

  // Fetch parent info on mount
  useEffect(() => {
    async function fetchParentInfo() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'Please log in to continue');
          router.replace('/(auth)/login');
          return;
        }

        const { data: parent, error } = await supabase
          .from('parents')
          .select('id, name, email')
          .eq('user_id', user.id)
          .single();

        if (error || !parent) {
          console.error('Error fetching parent:', error);
          Alert.alert('Error', 'Could not load your information');
          return;
        }

        setParentInfo(parent);
        setSignedName(parent.name || '');
      } catch (err) {
        console.error('Error in fetchParentInfo:', err);
      } finally {
        setLoadingParent(false);
      }
    }

    fetchParentInfo();
  }, []);

  // Handle scroll to end
  const handleScrollEnd = useCallback(() => {
    setHasScrolledToEnd(true);
  }, []);

  // Handle signature change
  const handleSignatureChange = useCallback((data: string | null) => {
    setSignatureData(data);
  }, []);

  // Proceed to signing step
  const handleProceedToSign = () => {
    if (!agreedToTerms) {
      Alert.alert(
        'Agreement Required',
        'Please read through the entire agreement and check the box to confirm you agree to the terms.'
      );
      return;
    }
    setCurrentStep('sign');
  };

  // Go back to reading step
  const handleBackToRead = () => {
    setCurrentStep('read');
  };

  // Submit signed agreement
  const handleSubmitAgreement = async () => {
    if (!parentInfo) {
      Alert.alert('Error', 'Parent information not available');
      return;
    }

    if (!signatureData) {
      Alert.alert('Signature Required', 'Please provide your signature to complete the agreement.');
      return;
    }

    if (!signedName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name to confirm the signature.');
      return;
    }

    try {
      // Create the agreement record
      const agreement = await createAgreement({
        parentId: parentInfo.id,
        agreementVersion: AGREEMENT_VERSION,
        agreementType: 'tutoring_services',
        expiresInDays: 0, // No expiration for signed agreements
      });

      if (!agreement) {
        Alert.alert('Error', agreementError || 'Failed to create agreement. Please try again.');
        return;
      }

      // Sign the agreement
      const signed = await signAgreement({
        agreementId: agreement.id,
        signatureData: signatureData,
        signedByName: signedName.trim(),
        signedByEmail: parentInfo.email,
      });

      if (!signed) {
        Alert.alert('Error', agreementError || 'Failed to sign agreement. Please try again.');
        return;
      }

      // Update parent record to mark agreement as signed
      await supabase
        .from('parents')
        .update({
          requires_agreement: false,
          agreement_signed_at: new Date().toISOString(),
        })
        .eq('id', parentInfo.id);

      // Show success and navigate to next onboarding step
      Alert.alert(
        'Agreement Signed!',
        'Thank you for signing the tutoring services agreement. Let\'s continue setting up your profile.',
        [
          {
            text: 'Continue',
            onPress: () => router.push('/(auth)/onboarding/profile'),
          },
        ]
      );
    } catch (err: any) {
      console.error('Error submitting agreement:', err);
      Alert.alert('Error', err.message || 'An unexpected error occurred');
    }
  };

  // Skip agreement (for development/testing)
  const handleSkip = async () => {
    if (__DEV__) {
      Alert.alert(
        'Skip Agreement',
        'This is a development feature. In production, agreements are required.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip',
            style: 'destructive',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    }
  };

  // Loading state
  if (loadingParent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3D9CA8" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!parentInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Unable to Load</Text>
          <Text style={styles.errorText}>Could not load your information. Please try again.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.retryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Reading step
  if (currentStep === 'read') {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="document-text" size={28} color="#3D9CA8" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Service Agreement</Text>
              <Text style={styles.headerSubtitle}>Please review before signing</Text>
            </View>
          </View>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
        </View>

        {/* Agreement Content */}
        <View style={styles.agreementContainer}>
          <AgreementScrollView
            tutorName="Love to Learn Academy"
            onScrollEnd={handleScrollEnd}
          />
        </View>

        {/* Scroll Hint */}
        {!hasScrolledToEnd && (
          <View style={styles.scrollHint}>
            <Ionicons name="arrow-down" size={16} color="#3D9CA8" />
            <Text style={styles.scrollHintText}>Scroll down to read the full agreement</Text>
          </View>
        )}

        {/* Agreement Checkbox */}
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            disabled={!hasScrolledToEnd}
          >
            <View style={[
              styles.checkboxBox,
              agreedToTerms && styles.checkboxBoxChecked,
              !hasScrolledToEnd && styles.checkboxBoxDisabled,
            ]}>
              {agreedToTerms && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={[
              styles.checkboxLabel,
              !hasScrolledToEnd && styles.checkboxLabelDisabled,
            ]}>
              I have read and agree to the terms and conditions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!agreedToTerms || !hasScrolledToEnd) && styles.continueButtonDisabled,
            ]}
            onPress={handleProceedToSign}
            disabled={!agreedToTerms || !hasScrolledToEnd}
          >
            <Text style={styles.continueButtonText}>Continue to Sign</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip (Dev Only)</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Signing step
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.signScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToRead}>
              <Ionicons name="arrow-back" size={24} color="#1B3A4B" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Ionicons name="create" size={28} color="#3D9CA8" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Sign Agreement</Text>
                <Text style={styles.headerSubtitle}>Provide your digital signature</Text>
              </View>
            </View>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotCompleted]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <View style={[styles.stepLine, styles.stepLineCompleted]} />
              <View style={[styles.stepDot, styles.stepDotActive]} />
            </View>
          </View>

          {/* Signer Info */}
          <View style={styles.signerInfo}>
            <Text style={styles.signerLabel}>Signing as:</Text>
            <View style={styles.signerCard}>
              <Ionicons name="person" size={24} color="#3D9CA8" />
              <View style={styles.signerDetails}>
                <Text style={styles.signerName}>{parentInfo.name}</Text>
                <Text style={styles.signerEmail}>{parentInfo.email}</Text>
              </View>
            </View>
          </View>

          {/* Name Confirmation */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Legal Name *</Text>
            <TextInput
              style={styles.textInput}
              value={signedName}
              onChangeText={setSignedName}
              placeholder="Type your full legal name"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            <Text style={styles.inputHint}>
              Please type your name exactly as it should appear on the signed document
            </Text>
          </View>

          {/* Signature Pad */}
          <View style={styles.signatureSection}>
            <Text style={styles.inputLabel}>Your Signature *</Text>
            <SignaturePad
              width={screenWidth - 48}
              height={150}
              strokeColor="#1B3A4B"
              strokeWidth={2}
              backgroundColor="#FFFFFF"
              placeholder="Draw your signature here"
              onSignatureChange={handleSignatureChange}
            />
          </View>

          {/* Legal Notice */}
          <View style={styles.legalNotice}>
            <Ionicons name="information-circle" size={20} color="#3D9CA8" />
            <Text style={styles.legalNoticeText}>
              By signing above, you acknowledge that you have read, understood, and agree to the
              terms of the Tutoring Services Agreement. Your digital signature is legally binding.
            </Text>
          </View>

          {/* Error Message */}
          {agreementError && (
            <View style={styles.errorMessage}>
              <Ionicons name="alert-circle" size={20} color="#F44336" />
              <Text style={styles.errorMessageText}>{agreementError}</Text>
              <TouchableOpacity onPress={clearError}>
                <Ionicons name="close" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!signatureData || !signedName.trim() || agreementLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitAgreement}
              disabled={!signatureData || !signedName.trim() || agreementLoading}
            >
              {agreementLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Sign & Submit Agreement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A6572',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B3A4B',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#4A6572',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3D9CA8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E8EC',
  },
  backButton: {
    padding: 8,
    marginBottom: 8,
    marginLeft: -8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B3A4B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#4A6572',
    marginTop: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E8EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#3D9CA8',
  },
  stepDotCompleted: {
    backgroundColor: '#7CB342',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E0E8EC',
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#7CB342',
  },

  // Agreement content
  agreementContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E8EC',
    overflow: 'hidden',
  },

  // Scroll hint
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#E8F5F7',
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  scrollHintText: {
    fontSize: 14,
    color: '#3D9CA8',
    marginLeft: 8,
  },

  // Checkbox
  checkboxContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#3D9CA8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxBoxChecked: {
    backgroundColor: '#3D9CA8',
  },
  checkboxBoxDisabled: {
    borderColor: '#D0D5DD',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1B3A4B',
  },
  checkboxLabelDisabled: {
    color: '#999',
  },

  // Buttons
  buttonContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3D9CA8',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3D9CA8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  skipButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#999',
  },

  // Sign step
  signScrollContent: {
    paddingBottom: 24,
  },
  signerInfo: {
    padding: 16,
  },
  signerLabel: {
    fontSize: 12,
    color: '#4A6572',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E8EC',
  },
  signerDetails: {
    marginLeft: 12,
  },
  signerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B3A4B',
  },
  signerEmail: {
    fontSize: 14,
    color: '#4A6572',
    marginTop: 2,
  },

  // Input group
  inputGroup: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3A4B',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E8EC',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1B3A4B',
  },
  inputHint: {
    fontSize: 12,
    color: '#8A9BA8',
    marginTop: 8,
  },

  // Signature section
  signatureSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },

  // Legal notice
  legalNotice: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F7',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  legalNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#2D7A84',
    marginLeft: 12,
    lineHeight: 20,
  },

  // Error message
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorMessageText: {
    flex: 1,
    fontSize: 14,
    color: '#F44336',
    marginHorizontal: 8,
  },

  // Submit button
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7CB342',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#7CB342',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
