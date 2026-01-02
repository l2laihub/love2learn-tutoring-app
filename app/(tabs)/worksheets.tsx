import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function WorksheetsScreen() {
  const handleGenerateWorksheet = () => {
    // TODO: Navigate to worksheet generator
    console.log('Generate worksheet pressed');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Worksheet Generator</Text>
          <Text style={styles.subtitle}>
            Create personalized math worksheets with AI
          </Text>
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateWorksheet}
        >
          <View style={styles.generateButtonContent}>
            <Ionicons name="sparkles" size={32} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Generate New Worksheet</Text>
            <Text style={styles.generateButtonSubtext}>
              Powered by AI for personalized learning
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <View style={styles.templateGrid}>
            <TouchableOpacity style={styles.templateCard}>
              <Ionicons name="add-circle-outline" size={24} color="#4CAF50" />
              <Text style={styles.templateText}>Addition</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.templateCard}>
              <Ionicons name="remove-circle-outline" size={24} color="#4CAF50" />
              <Text style={styles.templateText}>Subtraction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.templateCard}>
              <Ionicons name="close-circle-outline" size={24} color="#4CAF50" />
              <Text style={styles.templateText}>Multiplication</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.templateCard}>
              <Ionicons name="ellipse-outline" size={24} color="#4CAF50" />
              <Text style={styles.templateText}>Division</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Worksheets</Text>
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No worksheets generated yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first AI-generated worksheet above
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Worksheets</Text>
          <View style={styles.emptyState}>
            <Ionicons name="folder-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No saved worksheets</Text>
            <Text style={styles.emptySubtext}>
              Your saved worksheets will appear here
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonContent: {
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  generateButtonSubtext: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
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
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});
