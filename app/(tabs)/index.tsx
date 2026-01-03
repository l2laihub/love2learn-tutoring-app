import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthContext } from '../../src/contexts/AuthContext';

export default function HomeScreen() {
  const { parent, signOut, isTutor } = useAuthContext();

  const handleSignOut = async () => {
    console.log('Sign out button pressed');

    // Use window.confirm for web, or just sign out directly
    const shouldSignOut = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to sign out?')
      : true; // On native, we could use Alert, but for simplicity just sign out

    if (shouldSignOut) {
      console.log('Confirming sign out...');
      try {
        const { error } = await signOut();
        console.log('Sign out result:', error ? 'Error' : 'Success');
        if (!error) {
          router.replace('/(auth)/login');
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to sign out. Please try again.');
          }
        }
      } catch (e) {
        console.error('Sign out exception:', e);
        if (Platform.OS === 'web') {
          window.alert('An unexpected error occurred.');
        }
      }
    }
  };

  // Get first name for greeting
  const firstName = parent?.name?.split(' ')[0] ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.userInfo}>
              <View style={[
                styles.avatarContainer,
                isTutor && styles.tutorAvatarContainer
              ]}>
                <Ionicons
                  name={isTutor ? 'school' : 'person'}
                  size={24}
                  color={isTutor ? '#9C27B0' : '#FF6B6B'}
                />
              </View>
              <View>
                <Text style={styles.greeting}>
                  Welcome{firstName ? `, ${firstName}` : ''}!
                </Text>
                <View style={styles.roleContainer}>
                  <View style={[
                    styles.roleBadge,
                    isTutor ? styles.tutorBadge : styles.parentBadge
                  ]}>
                    <Ionicons
                      name={isTutor ? 'star' : 'people'}
                      size={12}
                      color={isTutor ? '#9C27B0' : '#666'}
                    />
                    <Text style={[
                      styles.roleText,
                      isTutor && styles.tutorRoleText
                    ]}>
                      {isTutor ? 'Tutor' : 'Parent'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && { opacity: 0.7 }
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="log-out-outline" size={24} color="#666" />
            </Pressable>
          </View>
        </View>

        {/* Tutor-specific dashboard */}
        {isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <View style={styles.placeholder}>
              <Ionicons name="calendar" size={32} color="#9C27B0" />
              <Text style={styles.placeholderText}>
                Your lessons for today will appear here
              </Text>
            </View>
          </View>
        )}

        {/* Parent-specific dashboard */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Children's Lessons</Text>
            <View style={styles.placeholder}>
              <Ionicons name="book" size={32} color="#FF6B6B" />
              <Text style={styles.placeholderText}>
                Your children's upcoming lessons will appear here
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isTutor ? 'Student Overview' : 'Quick Stats'}
          </Text>
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, styles.coralCard]}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>
                {isTutor ? 'Piano Students' : 'Piano Lessons'}
              </Text>
            </View>
            <View style={[styles.statCard, styles.greenCard]}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>
                {isTutor ? 'Math Students' : 'Math Lessons'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tutor: Payment overview */}
        {isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Status</Text>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, styles.blueCard]}>
                <Text style={styles.statNumber}>$0</Text>
                <Text style={styles.statLabel}>Due This Month</Text>
              </View>
              <View style={[styles.statCard, styles.orangeCard]}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>
        )}

        {/* Parent: Assignments */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            <View style={styles.placeholder}>
              <Ionicons name="document-text" size={32} color="#4CAF50" />
              <Text style={styles.placeholderText}>
                Worksheets and practice assignments will appear here
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.placeholder}>
            <Ionicons name="time" size={32} color="#999" />
            <Text style={styles.placeholderText}>
              Recent activity will appear here
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
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tutorAvatarContainer: {
    backgroundColor: '#F3E5F5',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  roleContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  parentBadge: {
    backgroundColor: '#F5F5F5',
  },
  tutorBadge: {
    backgroundColor: '#F3E5F5',
  },
  roleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tutorRoleText: {
    color: '#9C27B0',
  },
  signOutButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  placeholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coralCard: {
    backgroundColor: '#FF6B6B',
  },
  greenCard: {
    backgroundColor: '#4CAF50',
  },
  blueCard: {
    backgroundColor: '#2196F3',
  },
  orangeCard: {
    backgroundColor: '#FF9800',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    opacity: 0.9,
  },
});
