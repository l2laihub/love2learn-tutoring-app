import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleEditStudent = () => {
    // TODO: Navigate to edit student screen
    console.log('Edit student pressed', id);
  };

  const handleViewParent = () => {
    // TODO: Navigate to parent detail
    router.push('/parent/parent-1');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.studentName}>Student Name</Text>
          <Text style={styles.studentId}>ID: {id}</Text>

          <View style={styles.tagContainer}>
            <View style={[styles.tag, styles.pianoTag]}>
              <Text style={styles.tagText}>Piano</Text>
            </View>
            <View style={[styles.tag, styles.mathTag]}>
              <Text style={styles.tagText}>Math</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <Text style={styles.infoText}>student@example.com</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <Text style={styles.infoText}>(555) 123-4567</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parent/Guardian</Text>
          <TouchableOpacity style={styles.parentCard} onPress={handleViewParent}>
            <View style={styles.parentInfo}>
              <View style={styles.parentAvatar}>
                <Ionicons name="person-outline" size={24} color="#FF6B6B" />
              </View>
              <View>
                <Text style={styles.parentName}>Parent Name</Text>
                <Text style={styles.parentRelation}>Primary Contact</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesson Schedule</Text>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No lessons scheduled</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Progress</Text>
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No progress data yet</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worksheets</Text>
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No worksheets assigned</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No payment records</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={handleEditStudent}>
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit Student</Text>
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
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  studentName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  studentId: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pianoTag: {
    backgroundColor: '#FF6B6B',
  },
  mathTag: {
    backgroundColor: '#4CAF50',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  },
  parentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  parentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  parentRelation: {
    fontSize: 14,
    color: '#666',
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
