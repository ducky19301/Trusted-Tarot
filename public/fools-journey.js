/* The Fool's Journey: a modern teaching framework for the 22 Major Arcana.
   Original lesson text. The continuous journey is an interpretive model, not a claim about tarot's original historical purpose. */
(() => {
  "use strict";
  const chapters = [
    { number:0, title:"The Fool", cardId:"ar00", act:"I · The awakening", archetype:"The beginner at the threshold",
      story:[
        "The journey begins before the traveller knows what the journey is. The Fool stands at an edge with a light pack, open attention and more possibility than certainty. This is not proof that every leap is wise; it is the moment when curiosity becomes stronger than the comfort of staying still.",
        "The small dog can be read as instinct, companionship or a warning to pay attention. The sun and open landscape suggest vitality and room to move, while the cliff keeps the image honest: freedom still asks for awareness. The Fool has not failed by being inexperienced; the lesson is to stay open without abandoning judgment.",
        "The Fool is numbered zero, outside the numbered sequence in many readings. As the story's traveller, the Fool can return at every threshold. Each ending can make a new beginning possible, so the card frames the whole journey rather than simply standing at its start."
      ],
      symbolism:["The bundle suggests the tools and experiences not yet unpacked. The cliff is the unknown, not automatically disaster.","The dog can represent instinct or a loyal companion; read its action in the image rather than assigning one fixed meaning."],
      upright:"Openness, beginnings, trust, exploration and willingness to learn. In a practical reading, ask what deserves a first step and what preparation would make that step wiser.",
      reversed:"Carelessness, avoidance, fear of beginning or a leap taken without considering consequences. It can also show a person being too cautious to let life move.",
      astrology:"Often linked with Uranus in modern correspondences, emphasizing freedom, surprise and experimentation. This is a modern symbolic association, not a universal historical rule.",
      numberTheme:"Zero: potential, openness and the space before a defined form.",
      reading:"In a spread, The Fool can describe a fresh stage, an untested approach or the attitude someone brings. In an outcome position it shows possibility, not a guaranteed result.",
      history:"In early tarot game traditions the Fool had a special role distinct from the numbered trumps. The familiar cliff-edge traveller belongs to later illustrated tarot imagery, especially the Waite-Smith deck published in 1909.",
      reflection:"Where are you being invited to begin, and what would responsible openness look like?",
      practice:"Read The Fool in a Situation position, then in an Advice position. Write how the same image changes when the question changes."
    },
    { number:1, title:"The Magician", cardId:"ar01", act:"I · The awakening", archetype:"The maker who turns possibility into action",
      story:[
        "After the open threshold comes the discovery that the traveller can act. The Magician stands at a table with the tools of the four suits: wand, cup, sword and pentacle. The world is no longer only something to encounter; it is something the traveller can shape through attention, skill and choice.",
        "One hand points upward and the other downward in the Waite-Smith image, expressing a movement between idea and material action. The flowers around the figure suggest growth, but the tools still need a capable hand. Having resources is not the same as knowing how to use them.",
        "The Magician follows The Fool because possibility needs direction. The lesson is agency: name the intention, identify the resources, practise the skill and make the first move. Its shadow is manipulation, performance without substance or believing that confidence can replace competence."
      ],
      symbolism:["The four suit emblems bring thought, feeling, action and practical resources to one table.","The infinity sign suggests ongoing potential; the raised and lowered hands connect inspiration with execution."],
      upright:"Initiative, skill, focus, communication and making something happen with the resources available.",
      reversed:"Scattered effort, manipulation, unused ability, poor planning or a gap between what someone says and does.",
      astrology:"Mercury is a common modern correspondence, emphasizing language, learning, dexterity and exchange.",
      numberTheme:"One: initiative, identity and the first directed expression of potential.",
      reading:"Ask what tools are already available, what skill needs practice and whether the person's actions match their stated intention.",
      history:"The Magician descends from the historical tarot figure often called the Bagatto or Bagatella in early Italian decks, associated with a street performer or maker. Later occult systems gave the card layered esoteric correspondences.",
      reflection:"What do you already have that could become useful if you focused it?",
      practice:"Choose a real goal. Name one resource, one skill and one action that would turn intention into progress."
    },
    { number:2, title:"The High Priestess", cardId:"ar02", act:"I · The awakening", archetype:"The keeper of inner knowledge",
      story:[
        "Action alone cannot answer every question. The traveller meets the High Priestess, seated between two pillars with a scroll partly concealed. She represents the pause in which knowledge is received, observed and allowed to deepen before it is acted upon.",
        "The veil behind her separates the visible from what is not yet understood. The moon imagery connects the card with cycles, reflection and the changing nature of perception. Her silence is not a trick or a guarantee of supernatural certainty; it asks the reader to notice what has not yet been said.",
        "Following the Magician, the High Priestess balances outward skill with inward listening. The traveller learns that patience, study and discernment are forms of power. Her shadow is secrecy used to control, passivity disguised as wisdom or treating a hunch as unquestionable fact."
      ],
      symbolism:["The pillars suggest paired forces and the need to hold opposites in view. The veil marks a boundary between what is known and what remains hidden.","The scroll represents learning that unfolds over time; lunar imagery points to cycles and receptivity."],
      upright:"Intuition, study, privacy, observation and knowledge that needs time to emerge.",
      reversed:"Ignoring inner signals, withholding important information, confusion or mistaking suspicion for insight.",
      astrology:"The Moon is the common modern correspondence, linked with cycles, memory and the inner life.",
      numberTheme:"Two: polarity, receptivity, relationship and the space between alternatives.",
      reading:"Ask what is not yet visible, what evidence is missing and whether the best next move is to listen or investigate.",
      history:"The card's name and imagery changed across tarot traditions. The papal or female religious figure in earlier trumps was reimagined in occult-era decks as a priestess with esoteric symbolism.",
      reflection:"What do you know, what do you only suspect, and what would help you tell the difference?",
      practice:"Write two columns: observable facts and intuition. Practise keeping both without confusing one for the other."
    },
    { number:3, title:"The Empress", cardId:"ar03", act:"I · The awakening", archetype:"The force that nurtures growth",
      story:[
        "The traveller now encounters growth that cannot be forced. The Empress sits in a fertile landscape surrounded by signs of abundance. She represents the conditions that allow life, creativity, care and relationships to develop: nourishment, time, attention and a sense of belonging.",
        "Her crown of stars and the natural world around her connect the personal with wider cycles. The card is not limited to motherhood or to women. It can describe any person, place or practice that helps something living become more fully itself.",
        "After the High Priestess's quiet knowing, the Empress gives knowledge a body and a home. Her lesson is to tend what matters. Her shadow appears when care becomes smothering, comfort becomes avoidance or abundance is mistaken for endless capacity."
      ],
      symbolism:["Grain, garden and flowing water evoke fertility, sustenance and the cycles of nature.","The heart-shaped shield and Venus imagery connect affection, value and beauty with the material world."],
      upright:"Nurturing, creativity, growth, sensuality, comfort and generous care.",
      reversed:"Overgiving, neglecting one's own needs, creative stagnation, smothering or relying on comfort to avoid change.",
      astrology:"Venus is the common modern correspondence, associated with affection, pleasure, beauty and values.",
      numberTheme:"Three: creation, expression and the first visible growth from a pairing or idea.",
      reading:"Ask what needs tending, what is ready to grow and whether care is balanced with boundaries.",
      history:"The Empress is part of the early trump sequence and carries long-standing imperial and fertility imagery. Specific Venus associations became more explicit in later occult correspondences.",
      reflection:"What are you trying to grow, and what kind of care does it actually need?",
      practice:"Choose a project or relationship and identify one practical act of nourishment plus one boundary that protects it."
    },
    { number:4, title:"The Emperor", cardId:"ar04", act:"I · The awakening", archetype:"The builder of structure and responsibility",
      story:[
        "Growth needs a container. The Emperor sits on a stone throne in a stark landscape, representing order, limits, responsibility and the structures that make sustained work possible. He is the traveller's encounter with rules, leadership and the consequences of decisions.",
        "The ram imagery connects the card with force and initiative, while the armor beneath the robes suggests that authority carries duties and defenses. Structure can protect what is valuable, but it can also become rigid when it exists only to preserve control.",
        "Following the Empress, the Emperor teaches that care and creation need plans, resources and reliable boundaries. His shadow is domination, inflexibility or confusing authority with wisdom. Mature leadership creates stability without crushing life."
      ],
      symbolism:["The stone throne and barren mountains suggest endurance, boundaries and hard-won stability.","The ram motifs are commonly associated with Aries and assertive force in later correspondences."],
      upright:"Structure, leadership, accountability, protection, planning and clear boundaries.",
      reversed:"Rigidity, domination, weak foundations, avoidance of responsibility or rules that serve power rather than people.",
      astrology:"Aries is a common modern correspondence, emphasizing initiative, courage and directed force.",
      numberTheme:"Four: foundation, order, stability and the structures that hold a system together.",
      reading:"Ask who holds responsibility, whether the rules are fair and what practical structure would make the situation safer or more reliable.",
      history:"The Emperor is an early trump in historical decks, originally tied to worldly authority and hierarchy. Its modern psychological readings expand beyond a literal ruler.",
      reflection:"Where would a clear boundary or plan help, and where might control be getting in the way?",
      practice:"Draft three fair rules for a shared project. For each, explain what it protects and who is accountable."
    },
    { number:5, title:"The Hierophant", cardId:"ar05", act:"I · The awakening", archetype:"The teacher and the living tradition",
      story:[
        "The traveller has learned to act, listen, nurture and build. Now comes the question of how knowledge is passed from one person to another. The Hierophant represents teachers, institutions, shared practices and the traditions that give a community a common language.",
        "The figure's ceremonial clothing, raised hand and paired attendants show knowledge being taught within a recognized structure. Tradition can preserve hard-won insight and offer belonging. It can also become an obstacle when obedience replaces understanding or when a system refuses to learn.",
        "After the Emperor's structure, the Hierophant asks what gives that structure meaning. The traveller learns from others without surrendering the responsibility to think. Its shadow is dogma, gatekeeping or rebellion performed without understanding what is being rejected."
      ],
      symbolism:["The keys suggest access to knowledge and the responsibility that comes with it.","The two attendants and formal setting emphasize transmission, initiation and shared community practice."],
      upright:"Learning, mentorship, shared values, ritual, community and established systems of knowledge.",
      reversed:"Dogma, exclusion, pressure to conform, questioning a tradition or finding a more personal path.",
      astrology:"Taurus is a common modern correspondence, emphasizing values, continuity and embodied practice.",
      numberTheme:"Five: challenge, friction and the testing of a stable structure.",
      reading:"Ask which beliefs or institutions shape the situation, whose advice deserves trust and where independent judgment is needed.",
      history:"The card was historically associated with the Pope or religious authority in several early decks. The title Hierophant and its mystery-teaching language became prominent through later occult reinterpretation.",
      reflection:"Which inherited belief genuinely supports you, and which one deserves to be questioned?",
      practice:"Choose one tradition you follow. Write what it teaches, where it came from and whether it still serves its purpose."
    },
    { number:6, title:"The Lovers", cardId:"ar06", act:"I · The awakening", archetype:"The choice that reveals one's values",
      story:[
        "The traveller reaches a choice that cannot be solved by rules alone. The Lovers shows two figures beneath a larger presence, suggesting relationship, attraction, vulnerability and the need to choose in alignment with one's values.",
        "The card is often reduced to romance, but its deeper lesson is integration. A meaningful choice brings different desires, duties and truths into conversation. Connection asks for honesty and consent, not simply chemistry or the wish to be chosen.",
        "The Lovers follows the Hierophant because inherited values must eventually become personal commitments. The traveller decides what to stand for and how to meet another person without losing the self. Its shadow is divided loyalty, avoidance, idealization or a choice made to please someone else."
      ],
      symbolism:["The figures and the space between them evoke relationship and mutual recognition.","The angel or higher presence suggests a larger ethical or spiritual dimension to choice, depending on the deck and reader."],
      upright:"Connection, alignment, honest choice, shared values and meaningful partnership.",
      reversed:"Misalignment, avoidance, unequal exchange, temptation or difficulty choosing from one's own values.",
      astrology:"Gemini is the common modern correspondence, emphasizing dialogue, duality and the exchange between perspectives.",
      numberTheme:"Six: harmony, adjustment and the work of bringing opposing needs into relationship.",
      reading:"Ask what values are at stake, whether the exchange is mutual and what choice remains honest even if it is difficult.",
      history:"Earlier tarot versions often showed a marriage or choice scene. The familiar angelic pair in the Waite-Smith card reflects a later symbolic redesign.",
      reflection:"What choice would feel honest if you stopped trying to manage everyone else's reaction?",
      practice:"Use a two-path spread. Compare each option by values, practical consequences and the kind of relationship it creates."
    },
    { number:7, title:"The Chariot", cardId:"ar07", act:"II · The trials", archetype:"The driver who directs competing forces",
      story:[
        "Having chosen a direction, the traveller must now move. The Chariot represents will, discipline and the ability to guide forces that do not naturally pull together. The vehicle moves because its driver can hold a course, not because the road is free of conflict.",
        "The contrasting creatures or sphinxes in the Waite-Smith image point to opposing impulses. The driver has no obvious reins, suggesting that control may depend on inner coherence and disciplined attention. Confidence without direction becomes noise; direction without flexibility becomes force.",
        "The Chariot follows The Lovers because a choice becomes real through action. The lesson is sustained effort in the presence of competing demands. Its shadow is aggression, rushing, refusing help or mistaking movement for progress."
      ],
      symbolism:["The paired creatures suggest opposing impulses that must be directed rather than denied.","The canopy and armor evoke protection, focus and the public role of the traveller."],
      upright:"Determination, progress, self-command, ambition and purposeful movement.",
      reversed:"Loss of direction, force without control, burnout, impatience or a stalled plan.",
      astrology:"Cancer is the common modern correspondence, connecting drive with protection, belonging and emotional resolve.",
      numberTheme:"Seven: testing, movement and the need to steer through uncertainty.",
      reading:"Ask what direction is being pursued, what forces compete and whether the pace is sustainable.",
      history:"The Chariot appears among the early trump cards as a triumphal vehicle. Later systems connect it with personal will and astrological symbolism.",
      reflection:"What are you trying to move forward, and what competing impulses need to be brought into balance?",
      practice:"Write one goal, two competing pressures and a weekly action that keeps the goal moving without ignoring either pressure."
    },
    { number:8, title:"Strength", cardId:"ar08", act:"II · The trials", archetype:"Courage expressed through gentleness",
      story:[
        "The traveller discovers that force is not the only way to meet difficulty. Strength shows a person calmly engaging a lion, suggesting courage, patience and the ability to work with instinct rather than trying to crush it.",
        "The figure's gentle posture is central. Strength is not passivity and it is not domination; it is steady presence when fear, anger or appetite rises. The infinity sign above the figure echoes The Magician, but now skill is measured by self-command and care.",
        "Following the Chariot, Strength refines will into emotional steadiness. The traveller learns that restraint can be more powerful than reaction. Its shadow is suppressed anger, self-abandonment, bravado or allowing harmful behavior in the name of being patient."
      ],
      symbolism:["The lion can represent instinct, appetite, anger or vitality; the figure's response shows how these forces are met.","The infinity sign suggests enduring inner capacity, while the flowers soften the scene with patience and care."],
      upright:"Courage, patience, resilience, compassion and calm self-regulation.",
      reversed:"Self-doubt, reactivity, exhaustion, suppressed anger or confusing endurance with tolerating harm.",
      astrology:"Leo is the common modern correspondence, emphasizing heart, vitality and expressive courage.",
      numberTheme:"Eight in the Waite-Smith numbering: inner power and the sustained effort to meet a challenge. Some older decks number Strength differently.",
      reading:"Ask what needs calm courage, where instinct is useful and what boundary keeps gentleness from becoming self-erasure.",
      history:"Strength's position and number vary between major tarot traditions. The Waite-Smith deck places it at VIII, while Marseille-style decks commonly place it at XI.",
      reflection:"What would strength look like if it did not need to prove itself?",
      practice:"Choose a difficult conversation. Write one calm opening sentence, one boundary and one question that invites understanding."
    },
    { number:9, title:"The Hermit", cardId:"ar09", act:"II · The trials", archetype:"The seeker who finds clarity in solitude",
      story:[
        "After learning to guide action and instinct, the traveller steps away from noise. The Hermit carries a lamp and staff across a high, quiet place. This is deliberate solitude: time for study, reflection and the slow work of distinguishing what matters from what merely demands attention.",
        "The lamp illuminates only a small area. Wisdom rarely arrives as a complete map; it gives enough light for the next honest step. The staff represents support and experience, while the mountain suggests perspective gained through effort.",
        "The Hermit follows Strength because self-command makes it possible to be alone without being ruled by fear. The lesson is to seek truth and return with something useful. Its shadow is isolation, cynicism, withholding guidance or believing no one else can understand."
      ],
      symbolism:["The lantern holds a star, a small light carried into darkness rather than a floodlight that reveals everything.","The staff and mountain suggest experience, endurance and perspective earned over time."],
      upright:"Introspection, study, discernment, solitude, guidance and patient truth-seeking.",
      reversed:"Withdrawal, loneliness, avoidance, distrust or refusing help after reflection has become isolation.",
      astrology:"Virgo is a common modern correspondence, emphasizing analysis, discernment, study and careful service.",
      numberTheme:"Nine: culmination within a cycle, inner maturity and knowledge gathered before a new phase.",
      reading:"Ask what needs quiet attention, what evidence or experience has been gathered and when reflection should turn back into connection.",
      history:"The Hermit has appeared in early tarot as a solitary old man, sometimes associated with time or prudence. Later occult readings developed the seeker and inner-wisdom archetype.",
      reflection:"What truth becomes easier to hear when you step away from the noise, and who might benefit when you return?",
      practice:"Spend ten quiet minutes with a question. Write what you know, what you do not know and the next small step."
    },
    { number:10, title:"Wheel of Fortune", cardId:"ar10", act:"II · The trials", archetype:"The turning cycle of change",
      story:[
        "The traveller learns that not every change is caused by personal choice. The Wheel of Fortune turns through cycles of rise and fall, opportunity and disruption. It represents changing conditions, timing and the patterns that move beyond any one person's control.",
        "The wheel's figures climb, descend and remain in motion. The image does not promise that luck will always improve; it asks the reader to notice what is changing and how to respond. A cycle can open a door, but it cannot decide what someone does with the opening.",
        "The Wheel follows the Hermit's inward search with a reminder that insight must meet a moving world. The lesson is adaptability without fatalism. Its shadow is passivity, chasing luck or blaming every outcome on forces outside one's influence."
      ],
      symbolism:["The wheel is a cycle rather than a fixed destination. The surrounding creatures can represent different forms of knowledge and perspective.","The ascending and descending figures suggest changing fortunes and the instability of status."],
      upright:"Turning points, cycles, timing, change, chance and a shift in circumstances.",
      reversed:"Resistance to change, repeated patterns, delays or feeling swept along by events.",
      astrology:"Jupiter is a common modern correspondence, linked with expansion, opportunity and growth.",
      numberTheme:"Ten: completion of a cycle and the conditions for another beginning.",
      reading:"Ask what is changing, what pattern is repeating and which part of the response remains within the querent's control.",
      history:"The Wheel of Fortune is an old allegorical image in European art and literature, predating tarot. Early tarot adopted the familiar wheel of changing status and fortune.",
      reflection:"What is changing around you, and what choice remains yours even when the outcome is uncertain?",
      practice:"Map a repeating pattern as trigger, response and result. Identify one point where a different response is possible."
    },
    { number:11, title:"Justice", cardId:"ar11", act:"II · The trials", archetype:"The clear-eyed weighing of truth and consequence",
      story:[
        "The traveller now has to examine the consequences of choices. Justice sits between pillars with scales and a sword. The card asks for honesty, proportion, accountability and the willingness to see a situation as clearly as possible, including one's own part in it.",
        "The scales weigh evidence and competing claims; the sword cuts through evasion. Justice is not simply punishment or a guarantee that the world will be fair. It is the practice of making careful judgments and accepting that actions have effects.",
        "Justice follows the Wheel because changing circumstances still call for ethical response. The traveller learns to distinguish what happened, what can be proven and what responsibility belongs to whom. Its shadow is harsh judgment, denial, bias or using rules without compassion."
      ],
      symbolism:["The scales represent weighing evidence and proportion. The sword suggests clear decisions and the consequences that follow.","The frontal posture asks for directness: look at the matter rather than turning away."],
      upright:"Fairness, truth, accountability, clear decisions and proportionate consequences.",
      reversed:"Bias, evasion, unfair treatment, denial of responsibility or a decision made without enough evidence.",
      astrology:"Libra is the common modern correspondence, emphasizing balance, judgment and relationship.",
      numberTheme:"Eleven in the Waite-Smith sequence. Some older traditions exchange the positions of Justice and Strength.",
      reading:"Ask what is known, what is assumed, what is fair and what responsibility can be acted on now.",
      history:"Justice is an established allegorical figure in European art and appears in early tarot trumps. Its number differs across deck traditions.",
      reflection:"What would a fair account include if you gave every person, including yourself, the same standard?",
      practice:"Take a disagreement and separate facts, interpretations, needs and responsibilities into four columns."
    },
    { number:12, title:"The Hanged Man", cardId:"ar12", act:"II · The trials", archetype:"The pause that changes perspective",
      story:[
        "The traveller reaches a point where pushing harder does not help. The Hanged Man is suspended upside down, calm rather than visibly struggling. The card represents a chosen pause, surrender of an unhelpful approach and the possibility that a new perspective changes the question itself.",
        "The halo suggests insight, but the image does not say that suffering is automatically noble or that every delay is meaningful. The important distinction is between a pause that creates understanding and a situation in which someone is trapped or harmed.",
        "Following Justice, the Hanged Man asks the traveller to suspend a verdict long enough to see differently. Its lesson is flexibility and conscious release. Its shadow is martyrdom, paralysis, endless waiting or calling helplessness a choice."
      ],
      symbolism:["The inverted body reverses the usual viewpoint; the calm face suggests a pause rather than panic.","The crossed leg and living tree evoke deliberate suspension and the possibility of insight through a different position."],
      upright:"Pause, surrender, reframing, patience and a willing change of perspective.",
      reversed:"Stagnation, needless sacrifice, refusal to let go or waiting without learning.",
      astrology:"Neptune is a common modern correspondence, associated with surrender, imagination and blurred boundaries.",
      numberTheme:"Twelve: a completed pattern viewed from a new angle; it also echoes cycles of twelve in calendars and symbolic systems.",
      reading:"Ask what can be paused, what assumption needs turning over and whether the person has agency in the situation.",
      history:"The card's image has been linked to the historical motif of the traitor's punishment, later reinterpreted by occult writers as voluntary suspension and spiritual insight.",
      reflection:"What might become visible if you stopped trying to force the current solution?",
      practice:"Rewrite a problem from the perspective of someone else involved. Note one assumption that changes."
    },
    { number:13, title:"Death", cardId:"ar13", act:"III · The transformation", archetype:"The ending that makes change possible",
      story:[
        "The traveller meets an ending that cannot be negotiated away. Death rides through a scene of figures from different stations in life, reminding us that change reaches everyone. In most everyday readings the card points to an ending, transition or deep transformation, not a literal prediction of physical death.",
        "The rising sun in the distance suggests that an ending can open a new horizon, but it does not make loss painless or automatically good. The card asks what has run its course, what must be grieved and what cannot be carried into the next stage unchanged.",
        "Death follows the Hanged Man because a new perspective can reveal what needs to end. The lesson is release with honesty. Its shadow is clinging, fear, destructive change for its own sake or using transformation language to dismiss real grief."
      ],
      symbolism:["The skeleton shows what remains when surface identities fall away. The banner and horse move through the scene rather than stopping for status.","The distant sunrise can suggest continuation after an ending, not an instant happy ending."],
      upright:"Ending, transition, release, transformation and the closing of an old chapter.",
      reversed:"Resistance, prolonged endings, fear of change or holding on after a transition has begun.",
      astrology:"Scorpio is the common modern correspondence, associated with depth, endings, renewal and shared vulnerability.",
      numberTheme:"Thirteen: a threshold number often associated with change in later symbolic traditions; its meaning depends on the system used.",
      reading:"Ask what is ending, what needs grieving and what practical transition must happen next. Do not read this card as a literal death forecast.",
      history:"The trump was sometimes left unnamed in early printed decks, earning the nickname the unnamed card. The skeleton and reaper imagery draws on medieval European personifications of death.",
      reflection:"What has already ended in practice, even if you have not yet named it?",
      practice:"Write a respectful closing statement for a habit, role or commitment that no longer fits. Add one practical step for the transition."
    },
    { number:14, title:"Temperance", cardId:"ar14", act:"III · The transformation", archetype:"The art of integration and measure",
      story:[
        "After an ending, the traveller must learn how to live with what remains. Temperance pours liquid between two cups, blending rather than forcing. The card represents integration, moderation, patience and the steady work of finding a workable rhythm.",
        "One foot on land and one in water connect practical life with feeling. The path and distant light suggest that balance is not a static point but a direction maintained through repeated adjustments. Too much restraint can become avoidance; too much intensity can undo the work.",
        "Temperance follows Death because transformation needs time to settle into daily life. The traveller learns to combine different needs without erasing their differences. Its shadow is excess, forced compromise, impatience or losing one's own needs in the name of keeping peace."
      ],
      symbolism:["The two cups show exchange and blending. The differing foot positions connect emotion with practical ground.","The path toward the light suggests gradual progress rather than instant perfection."],
      upright:"Moderation, integration, patience, healing through balance and sustainable cooperation.",
      reversed:"Excess, imbalance, impatience, forced compromise or a routine that cannot be maintained.",
      astrology:"Sagittarius is the common modern correspondence, connecting the card with synthesis, exploration and meaning.",
      numberTheme:"Fourteen reduces to five in numerology, but the card's own lesson is measured integration after a major ending.",
      reading:"Ask what needs combining, what requires a slower pace and which adjustment would make the situation sustainable.",
      history:"Temperance is one of the classical virtues represented in European art, and it appears in early tarot as an allegorical trump. Angelic imagery is a later visual development.",
      reflection:"Which two needs seem opposed, and what would a workable middle practice look like?",
      practice:"Design a small daily routine that balances two competing needs. Test whether it is realistic for one week."
    },
    { number:15, title:"The Devil", cardId:"ar15", act:"III · The transformation", archetype:"The bonds we must learn to recognize",
      story:[
        "The traveller now faces the forces that bind attention and choice. The Devil shows figures held by chains near a dark, commanding figure. The image can represent attachment, compulsion, shame, exploitation or a pattern that feels more powerful when it remains unnamed.",
        "In the Waite-Smith image the chains appear loose enough to be removed, a detail often read as the possibility of recognizing one's participation in a pattern. That must never be used to blame people for coercion, addiction or abuse. Some bonds are imposed and require support, safety and practical help to change.",
        "The Devil follows Temperance because integration includes facing what has been avoided or overindulged. The lesson is honest recognition without shame. Its shadow is denial, obsession, manipulation or pretending that every constraint can be escaped by willpower alone."
      ],
      symbolism:["The chains suggest attachment and constraint; their looseness in this particular image can imply that some patterns are maintained without being fully examined.","The torch and animal features draw on older images of temptation and instinct, but their meaning should be read in context."],
      upright:"Attachment, temptation, power dynamics, compulsion, material fixation and facing a difficult pattern.",
      reversed:"Recognizing a harmful pattern, loosening an attachment, secrecy or continuing a cycle despite seeing it clearly.",
      astrology:"Capricorn is the common modern correspondence, associated with material structures, ambition and limits.",
      numberTheme:"Fifteen reduces to six, echoing choice and relationship; here the question is what one is bound to and why.",
      reading:"Ask what holds power, where consent and choice are present, and what support would make change safer. Never assume a person is responsible for abuse done to them.",
      history:"The Devil draws on medieval Christian and European images of temptation and bondage. Its later occult readings add psychological and astrological layers.",
      reflection:"What pattern becomes easier to change when you name it without judging yourself?",
      practice:"Map one repeated habit: cue, action, short-term reward and longer-term cost. Identify one safe support or interruption."
    },
    { number:16, title:"The Tower", cardId:"ar16", act:"III · The transformation", archetype:"The collapse of a false or unstable structure",
      story:[
        "The traveller encounters a structure that can no longer hold. Lightning strikes the tower and figures fall from its height. The card represents disruption, revelation and the collapse of assumptions or systems that were less secure than they appeared.",
        "The Tower is not a moral punishment and does not promise catastrophe. Sometimes a truth arrives suddenly; sometimes a long-ignored weakness finally becomes impossible to hide. The practical question is what needs immediate attention and what can be rebuilt on firmer ground.",
        "The Tower follows the Devil because recognizing a binding pattern can expose the structure that keeps it in place. The lesson is to face reality and respond carefully. Its shadow is panic, destructive impulsiveness or rebuilding the same fragile system without learning from the break."
      ],
      symbolism:["Lightning is sudden illumination and disruption. The crown falling from the tower can represent a claim to authority being overturned.","The falling figures show the loss of control; the flames and dark sky emphasize the intensity of the moment."],
      upright:"Sudden change, revelation, disruption, exposure and the breakdown of unstable assumptions.",
      reversed:"Avoided change, internal upheaval, delayed consequences or beginning to rebuild after disruption.",
      astrology:"Mars is a common modern correspondence, emphasizing force, conflict and decisive rupture.",
      numberTheme:"Sixteen reduces to seven, linking the disruption with testing, reassessment and a search for direction.",
      reading:"Ask what has become unsustainable, what facts are now visible and what needs protection before rebuilding.",
      history:"The Tower is also called the House of God in some historical decks. Its lightning-struck architecture belongs to a long European tradition of images of pride, upheaval and divine judgment.",
      reflection:"What truth would you have to face if you stopped defending the current structure?",
      practice:"Choose a small system that is not working. Identify its weakest assumption and one repair that addresses the cause rather than the symptom."
    },
    { number:17, title:"The Star", cardId:"ar17", act:"III · The transformation", archetype:"Hope restored through openness",
      story:[
        "After the Tower's disruption, the traveller reaches a quieter landscape. The Star kneels beside water beneath a broad sky. The card represents renewal, hope, trust and the slow restoration of a relationship with life after a difficult period.",
        "The figure pours water both onto the land and into the pool, joining practical care with emotional renewal. The stars offer orientation rather than a guaranteed outcome. Hope here is not denial; it is the willingness to keep tending what can still grow.",
        "The Star follows the Tower because the collapse of an old structure can make room for a truer source of guidance. The lesson is gentle rebuilding. Its shadow is idealization, waiting for rescue or mistaking optimism for a plan."
      ],
      symbolism:["The large star and smaller stars create a sense of orientation and wider perspective.","Water poured onto land and back into the pool suggests renewal that nourishes both the outer world and inner life."],
      upright:"Hope, renewal, inspiration, openness, healing and faith in a workable future.",
      reversed:"Discouragement, disconnection, unrealistic idealism or difficulty trusting after disappointment.",
      astrology:"Aquarius is the common modern correspondence, linked with vision, community and future-minded ideas.",
      numberTheme:"Seventeen reduces to eight, connecting hope with resilience and the work of rebuilding.",
      reading:"Ask what restores energy, what support is available and what small act would make hope practical.",
      history:"The Star is part of the early trump sequence and draws on long-standing allegories of celestial guidance and renewal. The familiar naked figure and paired vessels are a later illustrated composition.",
      reflection:"What gives you honest hope, and what action would help that hope take root?",
      practice:"Write one realistic hope, one resource that supports it and one action you can take this week."
    },
    { number:18, title:"The Moon", cardId:"ar18", act:"III · The transformation", archetype:"The passage through uncertainty and imagination",
      story:[
        "The traveller enters a landscape where not everything can be seen clearly. The Moon lights a path between towers while a dog and wolf respond to its presence and a creature rises from the water. The card represents uncertainty, dreams, instinct and the stories the mind creates when evidence is incomplete.",
        "The path continues into the distance, but its turns are hidden. Fear and imagination can reveal something important, yet they can also distort. The Moon asks the reader to move carefully, check assumptions and allow ambiguity without turning every shadow into a threat.",
        "The Moon follows the Star because renewed hope still has to pass through uncertainty. The lesson is discernment in the dark. Its shadow is confusion, projection, anxiety or trusting an attractive story more than observable facts."
      ],
      symbolism:["The dog and wolf suggest familiar and untamed responses to instinct. The water creature can evoke what rises from the unconscious or the unknown.","The winding path marks a journey without full visibility; the towers create a threshold rather than a final answer."],
      upright:"Uncertainty, dreams, imagination, intuition, hidden fears and incomplete information.",
      reversed:"Confusion clearing, truth emerging, anxiety easing or a refusal to face what remains uncertain.",
      astrology:"Pisces is the common modern correspondence, emphasizing imagination, sensitivity and porous boundaries.",
      numberTheme:"Eighteen reduces to nine, returning the traveller to inner reflection before the final illumination.",
      reading:"Ask what is known, what is imagined and what evidence could help distinguish the two. Avoid treating fear as proof.",
      history:"The Moon has long appeared as an allegorical trump, with animals and a night scene. Its specific dog, wolf, towers and water creature became familiar through later deck designs.",
      reflection:"Which part of the situation is fact, which is fear, and what do you still need to learn?",
      practice:"Write a worry as a hypothesis. List evidence for it, evidence against it and one grounded way to gather more information."
    },
    { number:19, title:"The Sun", cardId:"ar19", act:"III · The transformation", archetype:"Clarity, vitality and earned joy",
      story:[
        "The traveller emerges into daylight. The Sun shows a child riding freely beneath a bright sun, a scene of vitality, warmth and uncomplicated presence. After the uncertainty of the Moon, the card represents clarity, confidence and the ability to enjoy what is real and available.",
        "The child is not burdened by elaborate armor or a hidden agenda. The image invites directness and openness, but it does not say that life becomes perfect or that every difficulty disappears. Clear seeing can include both joy and responsibility.",
        "The Sun follows the Moon because uncertainty can be met with evidence, openness and renewed energy. The lesson is to let what is clear be clear. Its shadow is overconfidence, forced positivity or refusing to notice difficulties because the mood is bright."
      ],
      symbolism:["The sunflowers turn toward the light and suggest growth and vitality.","The child and white horse can represent openness, movement and a less defended relationship with life."],
      upright:"Clarity, vitality, joy, confidence, success and honest expression.",
      reversed:"Diminished confidence, delayed recognition, unrealistic positivity or difficulty receiving joy.",
      astrology:"The Sun is the direct modern correspondence, emphasizing identity, vitality and conscious expression.",
      numberTheme:"Nineteen reduces to ten and then one, echoing completion that renews the impulse to begin.",
      reading:"Ask what is now visible, what can be celebrated and where confidence needs to remain grounded.",
      history:"Solar imagery is ancient and widespread. The child on a horse and sunflower wall are features of the Waite-Smith composition, not a universal design across tarot history.",
      reflection:"What is genuinely working, and can you acknowledge it without pretending everything is solved?",
      practice:"Write three observable signs of progress and one next action that protects the progress."
    },
    { number:20, title:"Judgement", cardId:"ar20", act:"III · The transformation", archetype:"The call to awaken and answer",
      story:[
        "The traveller hears a call that asks for a response. Judgement shows figures rising at the sound of a trumpet, suggesting awakening, reckoning and the moment when the past is seen from a wider perspective. It is an invitation to answer honestly, not a command to condemn oneself.",
        "The figures emerge from enclosed spaces and face the sound together. The image can represent recognition, reconciliation or a decision to live differently after seeing what has been true. Reflection becomes meaningful when it changes how one acts.",
        "Judgement follows the Sun because clarity now asks for a deeper response. The traveller reviews the journey, accepts what cannot be undone and decides what to carry forward. Its shadow is harsh self-condemnation, fear of being seen or refusing a necessary reckoning."
      ],
      symbolism:["The trumpet suggests a call that breaks through ordinary distraction. The rising figures evoke renewal and collective response.","The open landscape replaces enclosure with visibility and the possibility of a new phase."],
      upright:"Awakening, accountability, renewal, reflection, forgiveness and answering a meaningful call.",
      reversed:"Self-judgment, avoidance, fear of consequences or difficulty accepting a second chance.",
      astrology:"Pluto is a common modern correspondence, emphasizing deep transformation, truth and renewal.",
      numberTheme:"Twenty reduces to two, returning to choice and relationship, now informed by the whole journey.",
      reading:"Ask what truth must be acknowledged, what can be repaired and what response would align with the person one is becoming.",
      history:"The card draws on Christian imagery of the Last Judgement, common in medieval art. Modern psychological readings often broaden it into self-assessment and awakening.",
      reflection:"What would you do differently if you accepted the lesson without defining yourself by the mistake?",
      practice:"Write a short review of one experience: what happened, what you learned, what can be repaired and what you will do next."
    },
    { number:21, title:"The World", cardId:"ar21", act:"III · The transformation", archetype:"Integration, completion and the next horizon",
      story:[
        "The traveller reaches the World, surrounded by a wreath with four figures at its corners. The card represents completion, integration and the ability to see how different parts of experience belong to a larger whole. The journey has changed the traveller, but it has not ended the possibility of learning.",
        "The central figure dances rather than stands rigidly at a finish line. The wreath is both a boundary and a frame: a cycle has been completed, and the four corner figures echo the fixed signs and the four living elements in later interpretations. The whole is made from distinct parts held in relationship.",
        "The World closes this telling of the Fool's Journey, but the Fool can begin again at a new level. Completion is not perfection; it is carrying experience forward with greater freedom, perspective and responsibility. Its shadow is unfinished business, fear of closure or refusing to recognize how far one has come."
      ],
      symbolism:["The wreath frames a completed cycle and can also suggest a threshold into the next one.","The four corner figures are often linked with the four evangelists, fixed zodiac signs or fourfold patterns, depending on the interpretive tradition."],
      upright:"Completion, integration, achievement, belonging, perspective and a cycle brought to a meaningful close.",
      reversed:"Incomplete closure, delays, loose ends, fear of finishing or difficulty recognizing an achievement.",
      astrology:"Saturn is a common modern correspondence, emphasizing time, structure and earned completion. Other systems use different correspondences.",
      numberTheme:"Twenty-one: the final numbered Major Arcana card in the Waite-Smith sequence; two plus one returns to three, expression and creation.",
      reading:"Ask what has come together, what lesson is now usable and what needs to be completed before a new cycle begins.",
      history:"The World is the final numbered trump in many tarot sequences. Its wreath and four corner figures have precedents in older European religious and allegorical imagery.",
      reflection:"What have you integrated, and what new beginning becomes possible because of it?",
      practice:"Review a completed project or life chapter. Name three skills gained, one thing to release and one intention for the next cycle."
    }
  ];
  const JOURNEY = chapters.map((c, i) => ({
    ...c,
    previous: i ? chapters[i - 1].title : null,
    next: i < chapters.length - 1 ? chapters[i + 1].title : null
  }));
  const W = typeof window !== "undefined" ? window : globalThis;
  W.FOOLS_JOURNEY = JOURNEY;
  if (typeof module !== "undefined") module.exports = JOURNEY;
})();
