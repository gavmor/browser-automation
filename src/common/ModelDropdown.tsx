import { Select } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { useAppState } from '../state/store';

const ModelDropdown = () => {
  const { selectedModel, updateSettings } = useAppState((state) => ({
    selectedModel: state.settings.selectedModel,
    updateSettings: state.settings.actions.update,
  }));
  const [models, setModels] = useState([])
  useEffect(() => {
    fetch('http://localhost:11434/api/tags', {})
      .then(response => response.json())
      .then(({models}) => setModels(models))
  }, [])

  return (
    // Chakra UI Select component
    <Select
      value={selectedModel || ''}
      onChange={(e) => updateSettings({ selectedModel: e.target.value })}>
        {models.map(({name, model, digest}) => (
          <option key={digest} value={model}>{name}</option>
        ))}
    </Select>
  );
};

export default ModelDropdown;
