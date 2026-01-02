import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ParentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleEditParent = () => {
    // TODO: Navigate to edit parent screen
    console.log('Edit parent pressed', id);
  };

  const handleViewStudent = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  const handleCall = () => {
    // TODO: Implement phone call
    console.log('Call parent');
  };

  const handleEmail = () => {
    // TODO: Implement email
    console.log('Email parent');
  };

  const handleMessage = () => {
    // TODO: Implement messaging
    console.log('Message parent');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.parentName}>Parent Name</Text>
          <Text style={styles.parentId}>ID: {id}</Text>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
            <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="mail" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
            <View style={[styles.actionIcon, { backgroundColor: '#FF6B6B' }]}>
              <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <Text style={styles.infoText}>parent@example.com</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <Text style={styles.infoText}>(555) 987-6543</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.infoText}>123 Main Street, City, ST 12345</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children/Students</Text>
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No students linked</Text>
            <Text style={styles.emptySubtext}>
              Link students to this parent
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentSummary}>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Total Paid</Text>
              <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
                $0.00
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Outstanding</Text>
              <Text style={[styles.paymentAmount, { color: '#FF6B6B' }]}>
                $0.00
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No payment history</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesPlaceholder}>
              Add notes about this parent...
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={handleEditParent}>
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit Parent</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  parentName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  parentId: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#CCC',
    marginTop: 4,
  },
  paymentSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 16,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notesPlaceholder: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  editButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
