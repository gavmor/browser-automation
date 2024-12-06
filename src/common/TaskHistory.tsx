import {
  VStack,
  HStack,
  Box,
  Accordion,
  AccordionItem,
  Heading,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spacer,
  ColorProps,
  BackgroundProps,
} from '@chakra-ui/react';
import React from 'react';
import { TaskHistoryEntry } from '../state/currentTask';
import { useAppState } from '../state/store';
import CopyButton from './CopyButton';

type TaskHistoryItemProps = {
  index: number;
  entry: TaskHistoryEntry;
};

const CollapsibleComponent = (props: {
  title: string;
  subtitle?: string;
  text: string;
}) => (
  <AccordionItem backgroundColor="white">
    <Heading as="h4" size="xs">
      <AccordionButton>
        <HStack flex="1">
          <Box>{props.title}</Box>
          <CopyButton text={props.text} /> <Spacer />
          {props.subtitle && (
            <Box as="span" fontSize="xs" color="gray.500" mr={4}>
              {props.subtitle}
            </Box>
          )}
        </HStack>
        <AccordionIcon />
      </AccordionButton>
    </Heading>
    <AccordionPanel>
      {props.text.split('\n').map((line, index) => (
        <Box key={index} fontSize="xs">
          {line}
          <br />
        </Box>
      ))}
    </AccordionPanel>
  </AccordionItem>
);

const TaskHistoryItem = ({ index, entry }: TaskHistoryItemProps) => {
  return (
    <AccordionItem>
      <Heading as="h3" size="sm" textColor={(colors(entry)).text} bgColor={(colors(entry)).bg}>
        <AccordionButton>
          <Box mr="4" fontWeight="bold">
            {index + 1}.
          </Box>
          <Box as="span" textAlign="left" flex="1">
            {itemTitle(entry)}
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </Heading>
      <AccordionPanel backgroundColor="gray.100" p="2">
        <Accordion allowMultiple w="full" defaultIndex={[1]}>
          <CollapsibleComponent
            title="Prompt"
            subtitle={`${entry.usage?.prompt_tokens} tokens`}
            text={entry.prompt}
          />
          <CollapsibleComponent
            title="Response"
            subtitle={`${entry.usage?.completion_tokens} tokens`}
            text={entry.response}
          />
          <CollapsibleComponent
            title="Action"
            text={JSON.stringify(entry.action, null, 2)}
          />
        </Accordion>
      </AccordionPanel>
    </AccordionItem>
  );
};

function colors(entry: TaskHistoryEntry): {
  text: ColorProps['textColor'];
  bg: BackgroundProps['bgColor'];
} {
  if (entry.action.action === 'fail') {
    return { text: 'red.800', bg: 'red.100' }
  }

  if (entry.action.action === 'finish') {
    return { text: 'green.800', bg: 'green.100' }
  }

  return { text: undefined, bg: undefined }
}

function itemTitle(entry: TaskHistoryEntry) {
  return entry.action.rationale || "Error: ???";
}

export default function TaskHistory() {
  const { taskHistory, taskStatus } = useAppState((state) => ({
    taskStatus: state.currentTask.status,
    taskHistory: state.currentTask.history,
  }));

  if (taskHistory.length === 0 && taskStatus !== 'running') return null;

  return ( 
    <VStack mt={8}>
      <HStack w="full">
        <Heading as="h3" size="md">
          Action History
        </Heading>
        <Spacer />
        <CopyButton text={JSON.stringify(taskHistory, null, 2)} />
      </HStack>
      <Accordion allowMultiple w="full" pb="4">
        {taskHistory.map((entry, index) => (
          <TaskHistoryItem key={index} index={index} entry={entry} />
        ))}
      </Accordion>
    </VStack>
  );
}
