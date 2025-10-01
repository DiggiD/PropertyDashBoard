// Shared D3 mock module for sankey tests
// Fully isolates D3 to avoid real sankey/stratify compute for speed

// Global flag to control error throwing for testing
global.d3 = global.d3 || {};
global.d3.sankey = global.d3.sankey || {};

const sankey = () => {
    // Check if we should throw an error for testing
    if (global.d3.sankey.shouldThrowError) {
        throw new Error('D3 sankey error');
    }

    // Create a function that can also have methods added to it
    function sankeyInstance(input) {
        return {
            nodes: input ? input.nodes || [] : [],
            links: input ? input.links || [] : [],
        };
    }

    // Add configuration methods that return self for chaining
    sankeyInstance.nodeId = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.nodeAlign = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.nodeWidth = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.nodePadding = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.extent = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.iterations = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.nodeSort = jest.fn().mockReturnValue(sankeyInstance);
    sankeyInstance.linkSort = jest.fn().mockReturnValue(sankeyInstance);

    return sankeyInstance;
};
const stratify = jest.fn(() => {
    // Check if we should throw an error for testing
    if (global.d3.stratify && global.d3.stratify.shouldThrowError) {
        throw new Error('D3 stratify error');
    }

    // Create a callable object (function with methods)
    const stratifyGenerator = function(data) {
    // When called with data, return the hierarchy
        const hierarchy = {
            descendants: () => {
                if (!Array.isArray(data)) {return [];}
                return data.map(d => ({ data: d, depth: d.depth || 0 }));
            },
            sum: jest.fn(function(value) { return this; }),
            sort: jest.fn(function(comparator) { return this; }),
            links: () => [],
        };
        return hierarchy;
    };

    // Add configuration methods that return self for chaining
    stratifyGenerator.parentId = jest.fn(() => stratifyGenerator);
    stratifyGenerator.children = jest.fn(() => stratifyGenerator);

    return stratifyGenerator;
});

const hierarchy = jest.fn();

const linkHorizontal = jest.fn(() => d => `M${d.source.x1} ${d.y0} L${d.target.x0} ${d.y0}`);

const easeCubicInOut = jest.fn(() => jest.fn());
const easeBackOut = jest.fn(() => jest.fn());
const min = jest.fn((array, accessor) => {
    if (Array.isArray(array) && accessor) {
        return Math.min(...array.map(accessor));
    }
    return Math.min(...arguments);
});
const max = jest.fn((array, accessor) => {
    if (Array.isArray(array) && accessor) {
        return Math.max(...array.map(accessor));
    }
    return Math.max(...arguments);
});
const forceSimulation = jest.fn(() => {
    const sim = {
        force: jest.fn(() => sim),
        nodes: jest.fn(() => []),
        links: jest.fn(() => []),
        alpha: jest.fn(() => sim),
        alphaDecay: jest.fn(() => sim),
        restart: jest.fn(() => sim),
        stop: jest.fn(() => sim),
    };
    return sim;
});
const forceLink = jest.fn(() => ({
    id: jest.fn(() => forceLink()),
    distance: jest.fn(() => forceLink()),
    strength: jest.fn(() => forceLink()),
}));
const forceManyBody = jest.fn(() => ({
    strength: jest.fn(() => forceManyBody()),
}));
const forceCenter = jest.fn(() => ({
    x: jest.fn(() => forceCenter()),
    y: jest.fn(() => forceCenter()),
}));
const forceRadial = jest.fn(() => ({
    strength: jest.fn(() => forceRadial()),
}));
const zoomObj = {
    scaleExtent: jest.fn(() => zoomObj),
    translateExtent: jest.fn(() => zoomObj),
    on: jest.fn(() => zoomObj),
    transform: jest.fn(() => jest.fn()), // transform returns a function for use with call
};

// Add a settable transform property to zoomObj
Object.defineProperty(zoomObj, 'transform', {
    get() {
        return this._transform || zoomIdentity;
    },
    set(value) {
        this._transform = value;
    },
    configurable: true,
    enumerable: true,
});

const zoom = jest.fn(() => zoomObj);

const zoomIdentity = {
    translate: jest.fn(function(tx, ty) {
        this.x = tx;
        this.y = ty;
        return this;
    }),
    scale: jest.fn(function(k) {
        this.k = k;
        return this;
    }),
    k: 1,
    x: 0,
    y: 0,
};
// Create a transition object that supports chaining
const createTransition = () => {
    const transition = {
        duration() { return transition; },
        ease() { return transition; },
        delay() { return transition; },
        style() { return transition; },
        attr() { return transition; },
        remove() { return transition; },
        call() { return transition; },
        on() { return transition; },
        attrTween() { return transition; },
        selectAll() { return transition; },
        select() { return transition; },
        each() { return transition; },
    };
    return transition;
};

// Create a selection object that supports chaining
const createSelection = () => {
    const attributes = {};
    const selection = {
        append() { return selection; },
        attr() { return selection; },
        style() { return selection; },
        classed() { return selection; },
        on() { return selection; },
        transition() { return createTransition(); },
        duration() { return selection; },
        ease() { return selection; },
        delay() { return selection; },
        remove() { return selection; },
        call() { return selection; },
        node() { return selection; },
        width() { return selection; },
        height() { return selection; },
        select() { return createSelection(); },
        selectAll() { return createSelection(); },
        data() { return createSelection(); },
        enter() { return createSelection(); },
        each() { return selection; },
        attrTween() { return selection; },
        empty() { return selection; },
        outerHTML: '<svg></svg>',
        html() { return selection; },
    };
    return selection;
};

const select = jest.fn(() => createSelection());
const selectAll = jest.fn();
const data = jest.fn();
const enter = jest.fn();
const append = jest.fn();
const attr = jest.fn();
const style = jest.fn();
const classed = jest.fn();
const on = jest.fn();
const transition = jest.fn();
const duration = jest.fn();
const ease = jest.fn();
const delay = jest.fn();
const remove = jest.fn();
const call = jest.fn();
const pointer = jest.fn(() => [100, 200]);
const sankeyLinkHorizontal = jest.fn(() => jest.fn(() => 'M0,0 L10,10'));
const interpolate = jest.fn();
const getTotalLength = jest.fn();
const scaleOrdinal = jest.fn();
const schemeCategory10 = jest.fn();

module.exports = {
    sankey,
    stratify,
    hierarchy,
    linkHorizontal,
    easeCubicInOut,
    easeBackOut,
    min,
    max,
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceRadial,
    zoom,
    zoomIdentity,
    select,
    selectAll,
    data,
    enter,
    append,
    attr,
    style,
    classed,
    on,
    transition,
    duration,
    ease,
    delay,
    remove,
    call,
    pointer,
    sankeyLinkHorizontal,
    interpolate,
    getTotalLength,
    scaleOrdinal,
    schemeCategory10,
};
